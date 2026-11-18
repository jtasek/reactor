// Loaded only when the chat uses it, so it adds nothing to the editor's bundle.
import type { Send } from './client';
import { HELP, interpret, localId, type Context, type Operation } from './local/interpret';

/** The name a local answer carries, which document history keeps as its model. */
export const LOCAL_MODEL = 'local-test-model';

/** How long the local model waits between streamed events, and with `/slow`. */
export const LOCAL_MODEL_TIMING = { eventMs: 120, slowEventMs: 900 };

/** What `/slow` and `/repair` ask for when nothing follows them. */
const DEFAULT_REQUEST = 'add a rectangle';

const FAILURES: Record<string, { status: number; code: string; streamed?: true }> = {
    limit: { status: 429, code: 'AI_LIMIT_REACHED' },
    busy: { status: 409, code: 'AI_BUSY' },
    off: { status: 403, code: 'AI_OFF' },
    forbidden: { status: 403, code: 'FORBIDDEN' },
    refused: { status: 200, code: 'AI_REFUSED', streamed: true },
    incomplete: { status: 200, code: 'AI_INCOMPLETE', streamed: true }
};

export const LOCAL_MODEL_HELP = HELP;

type Event = Record<string, unknown> & { type: string };

interface Answer {
    status?: number;
    code?: string;
    events: Event[];
    slow?: boolean;
}

/** The one `/repair` request still to be repaired: the operations its repair sends. */
let awaitingRepair: { requestId: string; operations: Operation[] } | undefined;

function answer(prompt: string, context: Context): Answer {
    const requestId = localId();
    const start: Event = { type: 'start', requestId, model: LOCAL_MODEL };
    const command = prompt.match(/^\/(\w+)\s*([\s\S]*)$/);
    const [, name = '', rest = prompt] = command ?? [];

    if (name === 'fail') {
        const kind = rest.trim().toLowerCase();
        const failure = FAILURES[kind];

        if (kind === 'network') {
            return { status: 0, events: [] };
        }
        if (!failure) {
            return {
                events: [start, { type: 'message', text: LOCAL_MODEL_HELP }, { type: 'done' }]
            };
        }

        return failure.streamed
            ? { events: [start, { type: 'error', code: failure.code }] }
            : { status: failure.status, code: failure.code, events: [] };
    }
    if (name === 'words') {
        return {
            events: [
                start,
                { type: 'message', text: rest.trim() || 'Just words.' },
                { type: 'done' }
            ]
        };
    }

    const scripted = name === 'slow' || name === 'repair';
    // `/slow` and `/repair` alone still need something to propose.
    // An unknown `/command` gets the help rather than a guess at its words.
    const { operations, text } =
        command && !scripted
            ? { operations: [], text: HELP }
            : interpret(scripted ? rest.trim() || DEFAULT_REQUEST : rest, context);
    const events = (list: Operation[]): Event[] => [
        start,
        // A proposal speaks for itself; only an answer without one needs words.
        ...(text ? [{ type: 'message', text }] : []),
        ...list.map((operation) => ({ type: 'operation', operation })),
        { type: 'done' }
    ];

    if (name === 'repair' && operations.length > 0) {
        awaitingRepair = { requestId, operations };

        return {
            events: events([
                {
                    op: 'updateShape',
                    shape: 'shape-that-is-not-there',
                    changes: { name: 'Broken' }
                },
                ...operations
            ])
        };
    }

    return { events: events(operations), slow: name === 'slow' };
}

/** Resolves after `ms`, or rejects as soon as `signal` aborts. */
const wait = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const stop = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', stop);
            resolve();
        }, ms);

        signal.addEventListener('abort', stop, { once: true });
    });

function stream({ events, slow }: Answer, signal: AbortSignal) {
    const encoder = new TextEncoder();
    const pace = slow ? LOCAL_MODEL_TIMING.slowEventMs : LOCAL_MODEL_TIMING.eventMs;
    // Stops the script when the reader gives up without aborting the request.
    const reading = new AbortController();
    const stopped = AbortSignal.any([signal, reading.signal]);

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                for (const event of events) {
                    await wait(pace, stopped);
                    controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
                }
                controller.close();
            } catch (error) {
                if (!reading.signal.aborted) {
                    controller.error(error);
                }
            }
        },
        cancel() {
            reading.abort();
        }
    });
}

/**
 * Answers the chat in this browser as the server's AI gateway does, from a
 * script rather than a model, so the chat can be tried with no server.
 */
export const localSend: Send = async (path, body, signal) => {
    signal.throwIfAborted();

    const repair = path.match(/^\/requests\/([^/]+)\/repairs$/);
    let reply: Answer;

    if (repair) {
        const requestId = decodeURIComponent(repair[1]);
        const operations =
            awaitingRepair?.requestId === requestId ? awaitingRepair.operations : undefined;

        awaitingRepair = undefined;
        reply = operations
            ? {
                  events: [
                      { type: 'start', requestId, model: LOCAL_MODEL },
                      {
                          type: 'message',
                          text: 'Local test model: fixed by dropping the broken change.'
                      },
                      ...operations.map((operation) => ({ type: 'operation', operation })),
                      { type: 'done' }
                  ]
              }
            : { status: 404, code: 'NOT_FOUND', events: [] };
    } else {
        const { prompt, context } = body as { prompt: string; context: Context };

        reply = answer(prompt.trim(), context);
    }

    if (reply.status === 0) {
        throw new TypeError('Failed to fetch');
    }
    if (reply.code && reply.status) {
        return Response.json({ code: reply.code }, { status: reply.status });
    }

    return new Response(stream(reply, signal), {
        headers: { 'content-type': 'application/x-ndjson' }
    });
};
