import {
    INSTRUCTIONS,
    TOOLS,
    callOperation,
    documentText,
    readEvents,
    repairReply,
    streamedBody,
    toolInput,
    type AiProvider,
    type AiRequest,
    type AiTask,
    type Conversation,
    type ToolCall,
    type Turn
} from './aiTasks.ts';

interface Chunk {
    choices?: Array<{
        delta?: {
            content?: string | null;
            refusal?: string | null;
            tool_calls?: Array<{
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
            }>;
        };
        finish_reason?: string | null;
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
    error?: { message?: string };
}

/** A tool call as it streams in, its arguments still JSON text. */
interface StreamedCall {
    id: string;
    name: string;
    arguments: string;
}

const TOOL_DEFINITIONS = TOOLS.map((tool) => ({ type: 'function', function: tool }));

const firstMessage = (request: AiRequest) => ({
    role: 'user',
    content: [
        { type: 'text', text: documentText(request) },
        ...(request.image
            ? [
                  {
                      type: 'image_url',
                      image_url: {
                          url: `data:${request.image.mediaType};base64,${request.image.data}`
                      }
                  }
              ]
            : []),
        { type: 'text', text: request.prompt }
    ]
});

/** Each refused answer as the model gave it, a tool message for each of its calls, then what to do. */
const messages = ({ request, repairs }: Conversation) => [
    { role: 'system', content: INSTRUCTIONS },
    firstMessage(request),
    ...repairs.flatMap(({ answer, problem }) => {
        const { results, text } = repairReply(answer, problem);

        return [
            answer.message,
            ...results.map(({ id, content, isError }) => ({
                role: 'tool',
                tool_call_id: id,
                content: isError ? `Error: ${content}` : content
            })),
            { role: 'user', content: text }
        ];
    })
];

const toolCall = ({ id, name, arguments: json }: StreamedCall): ToolCall => ({
    id,
    name,
    input: toolInput(json)
});

const STOPS: Record<string, Turn['stop']> = { length: 'incomplete', content_filter: 'refused' };

/**
 * Calls a server speaking the OpenAI Chat Completions API at `baseUrl`, as
 * OpenAI, Mistral, OpenRouter, Ollama or vLLM do, with plain fetch.
 */
export function openAiProvider({
    baseUrl,
    apiKey,
    models,
    fetch = globalThis.fetch
}: {
    baseUrl: string;
    /** Left out for a server that takes none, as a local one. */
    apiKey?: string;
    models: Record<AiTask, string>;
    fetch?: typeof globalThis.fetch;
}): AiProvider {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    return {
        model: (task) => models[task],
        async turn(conversation, signal, on) {
            const body = await streamedBody(
                await fetch(url, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
                    },
                    // No token cap: servers disagree on its name.
                    body: JSON.stringify({
                        model: models[conversation.request.task],
                        stream: true,
                        stream_options: { include_usage: true },
                        tools: TOOL_DEFINITIONS,
                        tool_choice: 'auto',
                        messages: messages(conversation)
                    }),
                    signal
                })
            );
            const calls: StreamedCall[] = [];
            let finished = 0;
            let text = '';
            let told = false;
            let refused = false;
            let finishReason = '';

            /** Tells the message once, before the first call, as the model wrote it first. */
            const tellMessage = () => {
                if (!told && text.trim()) {
                    on.message(text);
                }
                told = true;
            };
            /** Tells each call before `count`, as a later one has begun or the answer ended. */
            const finishCalls = (count: number) => {
                for (; finished < count; finished++) {
                    on.operation(callOperation(toolCall(calls[finished])));
                }
            };

            for await (const chunk of readEvents(body) as AsyncGenerator<Chunk>) {
                if (chunk.error) {
                    throw new Error(`The provider failed: ${chunk.error.message ?? 'unknown'}`);
                }
                if (chunk.usage) {
                    on.usage({
                        inputTokens: chunk.usage.prompt_tokens ?? 0,
                        outputTokens: chunk.usage.completion_tokens ?? 0
                    });
                }

                const [choice] = chunk.choices ?? [];

                text += choice?.delta?.content ?? '';
                refused ||= Boolean(choice?.delta?.refusal);
                (choice?.delta?.tool_calls ?? []).forEach(({ index, id, function: call }) => {
                    tellMessage();
                    finishCalls(index);
                    calls[index] ??= { id: id ?? `call_${index}`, name: '', arguments: '' };
                    calls[index].id = id ?? calls[index].id;
                    calls[index].name += call?.name ?? '';
                    calls[index].arguments += call?.arguments ?? '';
                });
                if (choice?.finish_reason) {
                    finishReason = choice.finish_reason;
                    tellMessage();
                    finishCalls(calls.length);
                }
            }

            return {
                answer: {
                    calls: calls.map(toolCall),
                    message: {
                        role: 'assistant',
                        content: text || null,
                        ...(calls.length > 0
                            ? {
                                  tool_calls: calls.map(({ id, name, arguments: json }) => ({
                                      id,
                                      type: 'function',
                                      function: { name, arguments: json }
                                  }))
                              }
                            : {})
                    }
                },
                stop: refused ? 'refused' : (STOPS[finishReason] ?? 'done')
            };
        }
    };
}
