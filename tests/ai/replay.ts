import { providerFromEnv } from '../../server/ai';

/** One event of the provider's stream, as it sends it. */
export type StreamEvent = Record<string, unknown>;

export type ProviderName = 'anthropic' | 'openai';

/**
 * A model's recorded answers to one request: the provider and model that gave
 * them, and the provider's events for each round.
 */
export interface Recording {
    provider: ProviderName;
    model: string;
    rounds: StreamEvent[][];
}

/** What the gateway sent the provider for one round. */
export interface Sent {
    body: {
        model: string;
        messages: Array<{ role: string; content: Array<Record<string, unknown>> }>;
    };
    signal: AbortSignal;
}

/** The model each provider's recordings are made with by default. */
export const MODELS: Record<ProviderName, string> = {
    anthropic: 'claude-haiku-5-5',
    openai: 'example-model'
};

/** A round as the provider streams it: Anthropic names each event, OpenAI ends with `[DONE]`. */
const serverSentEvents = (provider: ProviderName, events: StreamEvent[], ended: boolean) =>
    provider === 'anthropic'
        ? events.map((event) => `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`)
        : [
              ...events.map((event) => `data: ${JSON.stringify(event)}\n\n`),
              ...(ended ? ['data: [DONE]\n\n'] : [])
          ];

/**
 * A provider whose fetch answers each request with the next recorded round and
 * keeps what was sent. With `holdAfter`, a round stops after that many events
 * until its request is aborted, as a model still answering does.
 */
export function replay(
    rounds: StreamEvent[][],
    {
        holdAfter,
        provider = 'anthropic',
        model = MODELS[provider]
    }: { holdAfter?: number; provider?: ProviderName; model?: string } = {}
) {
    const sent: Sent[] = [];
    const encoder = new TextEncoder();

    const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
        const round = rounds[sent.length];
        const signal = init?.signal ?? new AbortController().signal;

        sent.push({ body: JSON.parse(String(init?.body)) as Sent['body'], signal });
        if (!round) {
            return new Response('{"type":"error","error":{"type":"api_error"}}', { status: 500 });
        }

        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                serverSentEvents(
                    provider,
                    round.slice(0, holdAfter),
                    holdAfter === undefined
                ).forEach((event) => controller.enqueue(encoder.encode(event)));
                if (holdAfter === undefined) {
                    controller.close();

                    return;
                }
                signal.addEventListener('abort', () => controller.error(signal.reason), {
                    once: true
                });
            }
        });

        return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
    };

    return {
        fetch,
        sent,
        provider: providerFromEnv(
            { AI_PROVIDER: provider, AI_API_KEY: 'test', AI_EDIT_MODEL: model },
            fetch
        )
    };
}

interface Answer {
    /** Tool calls, in order, each an operation's name and input. */
    calls?: Array<{ name: string; input: object }>;
    text?: string;
    stopReason?: string;
    inputTokens?: number;
    outputTokens?: number;
}

/** A round of events as Anthropic streams them: thinking, then text, then each tool call. */
export function answer({
    calls = [],
    text,
    stopReason = calls.length > 0 ? 'tool_use' : 'end_turn',
    inputTokens = 1200,
    outputTokens = 300
}: Answer): StreamEvent[] {
    const blocks: StreamEvent[][] = [
        [
            {
                type: 'content_block_start',
                content_block: { type: 'thinking', thinking: '', signature: '' }
            },
            { type: 'content_block_delta', delta: { type: 'signature_delta', signature: 'c2ln' } }
        ],
        ...(text === undefined
            ? []
            : [
                  [
                      { type: 'content_block_start', content_block: { type: 'text', text: '' } },
                      { type: 'content_block_delta', delta: { type: 'text_delta', text } }
                  ]
              ]),
        ...calls.map(({ name, input }, index): StreamEvent[] => {
            const json = JSON.stringify(input);
            const middle = Math.ceil(json.length / 2);

            return [
                {
                    type: 'content_block_start',
                    content_block: { type: 'tool_use', id: `toolu_${index + 1}`, name, input: {} }
                },
                ...[json.slice(0, middle), json.slice(middle)].map((part) => ({
                    type: 'content_block_delta',
                    delta: { type: 'input_json_delta', partial_json: part }
                }))
            ];
        })
    ];

    return [
        {
            type: 'message_start',
            message: {
                id: 'msg_recorded',
                type: 'message',
                role: 'assistant',
                model: 'claude-haiku-5-5',
                content: [],
                stop_reason: null,
                usage: { input_tokens: inputTokens, output_tokens: 1 }
            }
        },
        ...blocks.flatMap((events, index) => [
            ...events.map((event) => ({ ...event, index })),
            { type: 'content_block_stop', index }
        ]),
        {
            type: 'message_delta',
            delta: { stop_reason: stopReason, stop_sequence: null },
            usage: { output_tokens: outputTokens }
        },
        { type: 'message_stop' }
    ];
}

/** A round of chunks as an OpenAI-compatible server streams them: text, then each tool call. */
export function chatAnswer({
    calls = [],
    text,
    stopReason = calls.length > 0 ? 'tool_calls' : 'stop',
    inputTokens = 1200,
    outputTokens = 300
}: Answer): StreamEvent[] {
    const chunk = (delta: object, finishReason: string | null = null) => ({
        id: 'chatcmpl-recorded',
        object: 'chat.completion.chunk',
        model: MODELS.openai,
        choices: [{ index: 0, delta, finish_reason: finishReason }]
    });
    const halves = (value: string) => {
        const middle = Math.ceil(value.length / 2);

        return [value.slice(0, middle), value.slice(middle)];
    };

    return [
        chunk({ role: 'assistant', content: '' }),
        ...(text === undefined ? [] : halves(text).map((content) => chunk({ content }))),
        ...calls.flatMap(({ name, input }, index) => [
            chunk({
                tool_calls: [
                    {
                        index,
                        id: `call_${index + 1}`,
                        type: 'function',
                        function: { name, arguments: '' }
                    }
                ]
            }),
            ...halves(JSON.stringify(input)).map((part) =>
                chunk({ tool_calls: [{ index, function: { arguments: part } }] })
            )
        ]),
        chunk({}, stopReason),
        {
            id: 'chatcmpl-recorded',
            object: 'chat.completion.chunk',
            model: MODELS.openai,
            choices: [],
            usage: {
                prompt_tokens: inputTokens,
                completion_tokens: outputTokens,
                total_tokens: inputTokens + outputTokens
            }
        }
    ];
}
