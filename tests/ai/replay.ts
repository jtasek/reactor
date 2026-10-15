/** One event of the provider's stream, as it sends it. */
export type StreamEvent = { type: string } & Record<string, unknown>;

/** A model's recorded answers to one request: the provider's events for each round. */
export interface Recording {
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

const serverSentEvent = (event: StreamEvent) =>
    `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

/**
 * A provider's fetch that answers each request with the next recorded round and
 * keeps what was sent. With `holdAfter`, a round stops after that many events
 * until its request is aborted, as a model still answering does.
 */
export function replay(rounds: StreamEvent[][], { holdAfter }: { holdAfter?: number } = {}) {
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
                round
                    .slice(0, holdAfter)
                    .forEach((event) => controller.enqueue(encoder.encode(serverSentEvent(event))));
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

    return { fetch, sent };
}

interface Answer {
    /** Tool calls, in order, each an operation's name and input. */
    calls?: Array<{ name: string; input: object }>;
    text?: string;
    stopReason?: string;
    inputTokens?: number;
    outputTokens?: number;
}

/** A round of events as the provider streams them: thinking, then text, then each tool call. */
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
