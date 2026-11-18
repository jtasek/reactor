// Loaded only when the chat uses it, so it adds nothing to the editor's bundle.
import type { Send } from './client';

/** The name a local answer carries, which document history keeps as its model. */
export const LOCAL_MODEL = 'local-test-model';

/** How long the local model waits between streamed events, and with `/slow`. */
export const LOCAL_MODEL_TIMING = { eventMs: 120, slowEventMs: 900 };

/** Where shapes added to an empty document start, and the room between new shapes. */
const LAYOUT = { origin: 40, gap: 24 };

const SIZES = {
    rectangle: { width: 160, height: 48 },
    square: { width: 80, height: 80 },
    circle: 32,
    fontSize: 24,
    moveStep: 20
};

const COLORS: Record<string, string> = {
    red: '#e5484d',
    orange: '#f76b15',
    yellow: '#ffc53d',
    green: '#30a46c',
    teal: '#12a594',
    blue: '#3366ff',
    purple: '#8e4ec6',
    pink: '#d6409f',
    black: '#111111',
    white: '#ffffff',
    gray: '#8b8d98',
    grey: '#8b8d98'
};

const COUNTS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

/** What `/slow` and `/repair` ask for when nothing follows them. */
const DEFAULT_REQUEST = 'add a rectangle';

/** The most shapes one request adds. */
const MAX_ADDED = 10;

const FAILURES: Record<string, { status: number; code: string; streamed?: true }> = {
    limit: { status: 429, code: 'AI_LIMIT_REACHED' },
    busy: { status: 409, code: 'AI_BUSY' },
    off: { status: 403, code: 'AI_OFF' },
    forbidden: { status: 403, code: 'FORBIDDEN' },
    refused: { status: 200, code: 'AI_REFUSED', streamed: true },
    incomplete: { status: 200, code: 'AI_INCOMPLETE', streamed: true }
};

export const LOCAL_MODEL_HELP = [
    'This is the local test model: scripted answers made in this browser, with no AI and no server. It understands:',
    '• add a red rectangle, add 3 circles, add text "Hello", add a 200x60 blue square',
    '• with shapes selected: make them green, rename to "Card", move right 40, delete',
    '• /slow add 5 circles: streams slowly, so you can try Stop',
    '• /repair add a circle: starts with a broken change, so you can watch it be fixed',
    '• /words Hello: answers in words only',
    `• /fail ${[...Object.keys(FAILURES), 'network'].join(', ')}: the problems the server can report`
].join('\n');

type Event = Record<string, unknown> & { type: string };
type Operation = Record<string, unknown> & { op: string };
type ShapeFields = Record<string, unknown>;

interface Context {
    selection?: string[];
    shapes?: Record<string, ShapeFields>;
}

interface Answer {
    status?: number;
    code?: string;
    events: Event[];
    slow?: boolean;
}

/** The one `/repair` request still to be repaired: the operations its repair sends. */
let awaitingRepair: { requestId: string; operations: Operation[] } | undefined;

let made = 0;

/** An ID no other answer of this page carries; `crypto.randomUUID` needs a secure origin. */
const localId = () => `local-${Date.now().toString(36)}-${++made}`;

const number = (value: unknown) => (typeof value === 'number' ? value : 0);
const point = (value: unknown) =>
    value && typeof value === 'object' ? (value as ShapeFields) : {};

/** The lowest edge of a shape, read loosely: only the local model's layout needs it. */
function bottom(shape: ShapeFields) {
    const position = point(shape.position);
    const size = point(shape.size);
    const radius = shape.radius;

    if (shape.type === 'circle') {
        return number(position.y) + number(radius);
    }
    if (radius && typeof radius === 'object') {
        return number(position.y) + number(point(radius).y);
    }
    if (shape.type === 'line') {
        return Math.max(number(point(shape.start).y), number(point(shape.end).y));
    }

    return number(position.y) + (number(size.height) || number(shape.fontSize) || 0);
}

const colorIn = (words: string) =>
    words.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i)?.[0] ??
    COLORS[Object.keys(COLORS).find((name) => new RegExp(`\\b${name}\\b`).test(words)) ?? ''];

const quoted = (prompt: string) => prompt.match(/["“]([^"”]+)["”]/)?.[1];

function additions(prompt: string, words: string, context: Context): Operation[] {
    const found = words.match(
        /\b(rectangles?|rects?|box(?:es)?|squares?|circles?|texts?|labels?|headings?)\b/
    );

    if (!found) {
        return [];
    }
    const noun = found[1];
    // A count among the few words before the shape: "add 3 red circles".
    const before = words.slice(0, found.index).trim().split(/\s+/).slice(-4);
    const many = before.find((word) => /^\d+$/.test(word) || COUNTS[word]) ?? '1';
    const count = Math.min(Number(many) || COUNTS[many] || 1, MAX_ADDED);
    const kind = noun.startsWith('circle')
        ? 'circle'
        : /^(text|label|heading)/.test(noun)
          ? 'text'
          : noun.startsWith('square')
            ? 'square'
            : 'rectangle';
    const fill = colorIn(words);
    const sized = words.match(/\b(\d+)\s*[x×]\s*(\d+)\b/);
    const size = sized
        ? { width: Number(sized[1]), height: Number(sized[2]) }
        : SIZES[kind === 'square' ? 'square' : 'rectangle'];
    const name = quoted(prompt);
    let top =
        Math.max(
            LAYOUT.origin - LAYOUT.gap,
            ...Object.values(context.shapes ?? {})
                .map(bottom)
                .filter(Number.isFinite)
        ) + LAYOUT.gap;

    return Array.from({ length: count }, (_, index) => {
        const label = count > 1 && name ? `${name} ${index + 1}` : name;
        const left =
            LAYOUT.origin +
            index * ((kind === 'circle' ? SIZES.circle * 2 : size.width) + LAYOUT.gap);
        const shape =
            kind === 'circle'
                ? {
                      type: 'circle',
                      position: { x: left + SIZES.circle, y: top + SIZES.circle },
                      radius: SIZES.circle,
                      fill: fill ?? COLORS.blue
                  }
                : kind === 'text'
                  ? {
                        type: 'text',
                        position: { x: left, y: top },
                        value: label ?? 'Text',
                        fontSize: SIZES.fontSize,
                        ...(fill ? { fontColor: fill } : {})
                    }
                  : {
                        type: 'rectangle',
                        position: { x: left, y: top },
                        size,
                        fill: fill ?? COLORS.blue
                    };

        if (index === count - 1) {
            top += kind === 'circle' ? SIZES.circle * 2 : size.height;
        }

        return {
            op: 'addShape',
            key: localId(),
            shape: { ...shape, ...(label && kind !== 'text' ? { name: label } : {}) }
        };
    });
}

/** Changes to the selected shapes: delete, rename, move or recolor them. */
function changes(prompt: string, words: string, context: Context): Operation[] {
    const selection = (context.selection ?? []).filter((id) => context.shapes?.[id]);

    if (selection.length === 0) {
        return [];
    }
    if (/\b(delete|remove)\b/.test(words)) {
        return [{ op: 'deleteShapes', shapes: selection }];
    }

    const name = /\b(rename|name|call)\b/.test(words) ? quoted(prompt) : undefined;
    if (name) {
        return selection.map((shape) => ({ op: 'updateShape', shape, changes: { name } }));
    }

    const moved = words.match(/\bmove\b.*?\b(left|right|up|down)\b/);
    if (moved) {
        // "move right 40" and "move 40 right" both say how far.
        const distance = Number(
            words.slice(moved.index).match(/\b\d+(?:\.\d+)?\b/)?.[0] ?? SIZES.moveStep
        );
        const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[
            moved[1] as 'left'
        ];

        return selection.flatMap((shape) => {
            const position = context.shapes?.[shape].position;

            return position && typeof position === 'object'
                ? [
                      {
                          op: 'updateShape',
                          shape,
                          changes: {
                              position: {
                                  x: number(point(position).x) + dx * distance,
                                  y: number(point(position).y) + dy * distance
                              }
                          }
                      }
                  ]
                : [];
        });
    }

    const color = colorIn(words);
    if (color) {
        return selection.map((shape) => ({
            op: 'updateShape',
            shape,
            changes:
                context.shapes?.[shape].type === 'text' ? { fontColor: color } : { fill: color }
        }));
    }

    return [];
}

/** What the local model proposes for `prompt`, and the words it says first. */
function propose(prompt: string, context: Context): { operations: Operation[]; text: string } {
    const words = prompt.toLowerCase();
    // With shapes selected, "make the text red" changes them unless it asks to add something.
    const adds = /\b(add|create|draw|insert|new)\b/.test(words);
    const changed = adds ? [] : changes(prompt, words, context);
    const operations = changed.length > 0 ? changed : additions(prompt, words, context);

    return operations.length > 0
        ? { operations, text: 'Local test model: a scripted proposal, made without AI.' }
        : { operations, text: LOCAL_MODEL_HELP };
}

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
    const { operations, text } = propose(
        scripted ? rest.trim() || DEFAULT_REQUEST : command ? '' : rest,
        context
    );
    const events = (list: Operation[]): Event[] => [
        start,
        { type: 'message', text },
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
