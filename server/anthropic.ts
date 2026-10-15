import {
    INSTRUCTIONS,
    TOOLS,
    callOperation,
    documentText,
    readEvents,
    repairReply,
    streamedBody,
    taskMaxTokens,
    toolInput,
    type AiProvider,
    type AiRequest,
    type AiTask,
    type Conversation,
    type ToolCall,
    type Turn
} from './aiTasks.ts';

/** The Messages API, called with plain fetch. */
const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

const API_VERSION = '2023-06-01';

/** The model each task runs on unless configured otherwise, and how hard it thinks. */
const TASKS: Record<AiTask, { model: string; effort: string }> = {
    edit: { model: 'claude-haiku-5-5', effort: 'low' }
};

/** A content block of a message, as the provider reads and writes it. */
type Block = { type: string } & Record<string, unknown>;

interface ProviderUsage {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
}

interface StreamEvent {
    type: string;
    index?: number;
    message?: { usage?: ProviderUsage };
    content_block?: Block;
    delta?: {
        type?: string;
        text?: string;
        thinking?: string;
        signature?: string;
        partial_json?: string;
        stop_reason?: string;
    };
    usage?: ProviderUsage;
    error?: { type?: string; message?: string };
}

const TOOL_DEFINITIONS = TOOLS.map(({ name, description, parameters }) => ({
    name,
    description,
    input_schema: parameters
}));

/** The first message: the document, cached for a repair, any image, then the words. */
const firstMessage = (request: AiRequest) => ({
    role: 'user',
    content: [
        { type: 'text', text: documentText(request), cache_control: { type: 'ephemeral' } },
        ...(request.image
            ? [
                  {
                      type: 'image',
                      source: {
                          type: 'base64',
                          media_type: request.image.mediaType,
                          data: request.image.data
                      }
                  }
              ]
            : []),
        { type: 'text', text: request.prompt }
    ]
});

/** Each refused answer as the model gave it, then a result for each of its calls. */
const messages = ({ request, repairs }: Conversation) => [
    firstMessage(request),
    ...repairs.flatMap(({ answer, problem }) => {
        const { results, text } = repairReply(answer, problem);

        return [
            { role: 'assistant', content: answer.message },
            {
                role: 'user',
                content: [
                    ...results.map(({ id, content, isError }) => ({
                        type: 'tool_result',
                        tool_use_id: id,
                        content,
                        ...(isError ? { is_error: true } : {})
                    })),
                    { type: 'text', text }
                ]
            }
        ];
    })
];

const tokens = (usage: ProviderUsage | undefined) =>
    (usage?.input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0);

const toolCall = (block: Block): ToolCall => ({
    id: String(block.id),
    name: String(block.name),
    input: block.input as Record<string, unknown>
});

const STOPS: Record<string, Turn['stop']> = {
    end_turn: 'done',
    tool_use: 'done',
    refusal: 'refused',
    max_tokens: 'incomplete'
};

/** Calls Anthropic's Messages API with plain fetch, holding the key. */
export function anthropicProvider({
    apiKey,
    models = {},
    fetch = globalThis.fetch
}: {
    apiKey: string;
    /** Models to run tasks on instead of the defaults. */
    models?: Partial<Record<AiTask, string>>;
    fetch?: typeof globalThis.fetch;
}): AiProvider {
    const model = (task: AiTask) => models[task] ?? TASKS[task].model;

    return {
        model,
        async turn(conversation, signal, on) {
            const { task } = conversation.request;
            const body = await streamedBody(
                await fetch(MESSAGES_URL, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': API_VERSION
                    },
                    body: JSON.stringify({
                        model: model(task),
                        max_tokens: taskMaxTokens(task),
                        stream: true,
                        output_config: { effort: TASKS[task].effort },
                        tools: TOOL_DEFINITIONS,
                        system: [
                            {
                                type: 'text',
                                text: INSTRUCTIONS,
                                cache_control: { type: 'ephemeral' }
                            }
                        ],
                        messages: messages(conversation)
                    }),
                    signal
                })
            );
            const content: Block[] = [];
            const json = new Map<number, string>();
            const usage = { inputTokens: 0, outputTokens: 0 };
            let stopReason = '';
            let complete = false;

            for await (const event of readEvents(body) as AsyncGenerator<StreamEvent>) {
                const index = event.index ?? 0;
                const block = content[index];

                switch (event.type) {
                    case 'message_start':
                        usage.inputTokens = tokens(event.message?.usage);
                        usage.outputTokens = event.message?.usage?.output_tokens ?? 0;
                        on.usage({ ...usage });
                        break;
                    case 'content_block_start':
                        if (event.content_block) {
                            content[index] = { ...event.content_block };
                        }
                        break;
                    case 'content_block_delta':
                        switch (event.delta?.type) {
                            case 'text_delta':
                                block.text = `${String(block.text ?? '')}${event.delta.text}`;
                                break;
                            case 'thinking_delta':
                                block.thinking = `${String(block.thinking ?? '')}${event.delta.thinking}`;
                                break;
                            case 'signature_delta':
                                block.signature = event.delta.signature;
                                break;
                            case 'input_json_delta':
                                json.set(
                                    index,
                                    `${json.get(index) ?? ''}${event.delta.partial_json}`
                                );
                                break;
                        }
                        break;
                    case 'content_block_stop':
                        if (block?.type === 'tool_use') {
                            block.input = toolInput(json.get(index) ?? '');
                            on.operation(callOperation(toolCall(block)));
                        }
                        if (block?.type === 'text' && String(block.text).trim()) {
                            on.message(String(block.text));
                        }
                        break;
                    case 'message_delta':
                        stopReason = event.delta?.stop_reason ?? stopReason;
                        usage.outputTokens = event.usage?.output_tokens ?? usage.outputTokens;
                        if (tokens(event.usage) > 0) {
                            usage.inputTokens = tokens(event.usage);
                        }
                        on.usage({ ...usage });
                        break;
                    case 'error':
                        throw new Error(`The provider failed: ${event.error?.type ?? 'unknown'}`);
                    case 'message_stop':
                        complete = true;
                        break;
                }
            }

            return {
                answer: {
                    calls: content.filter((block) => block.type === 'tool_use').map(toolCall),
                    message: content
                },
                stop: complete ? (STOPS[stopReason] ?? 'incomplete') : 'incomplete'
            };
        }
    };
}
