/** The Messages API, called with plain fetch; the only provider so far. */
const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

const API_VERSION = '2023-06-01';

/** The model each task runs on, how hard it thinks and how long it may answer. */
const TASKS = {
    edit: { model: 'claude-haiku-5-5', effort: 'low', maxTokens: 16_000 }
} as const;

export type AiTask = keyof typeof TASKS;

export const isAiTask = (value: unknown): value is AiTask =>
    typeof value === 'string' && Object.hasOwn(TASKS, value);

export const taskModel = (task: AiTask) => TASKS[task].model;

/** A content block of a message, as the provider reads and writes it. */
export type Block = { type: string } & Record<string, unknown>;

interface Message {
    role: 'user' | 'assistant';
    content: Block[];
}

/** What a person asked for, with the document as the editor sends it and an image they attached. */
export interface AiRequest {
    task: AiTask;
    prompt: string;
    context: object;
    image?: { mediaType: string; data: string };
}

/** A request's messages so far, which a repair sends again with the model's answer. */
export interface Conversation {
    task: AiTask;
    messages: Message[];
}

/** Why the editor refused an answer: the operation, by its place among the answer's, and the problem. */
export interface Problem {
    operation?: number;
    problem: string;
}

export interface Usage {
    inputTokens: number;
    outputTokens: number;
}

/** What the model answered and why it stopped. */
export interface Turn {
    content: Block[];
    stopReason: string;
}

/** Told each operation and message as the model finishes it, and the tokens used so far. */
export interface TurnHandlers {
    operation(operation: object): void;
    message(text: string): void;
    usage(usage: Usage): void;
}

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

const INSTRUCTIONS = `You change a Reactor design document by calling tools: each call is one operation.
Reactor draws shapes on a canvas measured in pixels, with x to the right and y down. The person's
message starts with the document's records as JSON: its shapes, groups, variables and components,
each under its ID.

- Make the whole change in one answer, calling the tools in order. An operation may refer only to
  an ID the document has, or to the key of a record an earlier call of this answer adds.
- Give each new shape and variable a short key of your own; later calls use it as an ID.
- Colors are #rrggbb. A shape's property may follow a variable of its kind: its bindings map the
  property's key, such as fill, to the variable's ID or key.
- A group needs two or more shapes, each in no other group.
- Do only what was asked, and leave the rest of the document as it is.
- When the tools cannot make the change, say why in one sentence and call none.`;

const REPAIR = `None of these operations were applied. Call the tools again with every operation of
the corrected change, from the first.`;

const point = {
    type: 'object',
    properties: { x: { type: 'number' }, y: { type: 'number' } },
    required: ['x', 'y']
};

const color = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };

/** Fields any shape may have; fill and stroke only where the shape has an inside or an outline. */
const shapeFields = {
    name: { type: 'string' },
    description: { type: 'string' },
    rotation: { type: 'number', description: 'Degrees, clockwise.' },
    opacity: { type: 'number', minimum: 0, maximum: 1 },
    fill: color,
    stroke: color,
    bindings: {
        type: 'object',
        description: 'Property key to the ID or key of the variable it follows.',
        additionalProperties: { type: 'string' }
    }
};

const shapeKind = (type: string, properties: object, required: string[], description = '') => ({
    type: 'object',
    description,
    properties: { type: { type: 'string', enum: [type] }, ...shapeFields, ...properties },
    required: ['type', ...required]
});

const SHAPE = {
    anyOf: [
        shapeKind(
            'rectangle',
            {
                position: point,
                size: {
                    type: 'object',
                    properties: { width: { type: 'number' }, height: { type: 'number' } },
                    required: ['width', 'height']
                },
                cornerRadius: { type: 'number', minimum: 0 }
            },
            ['position', 'size'],
            'position is the top left corner.'
        ),
        shapeKind(
            'circle',
            { position: point, radius: { type: 'number', minimum: 0 } },
            ['position', 'radius'],
            'position is the center.'
        ),
        shapeKind(
            'ellipse',
            { position: point, radius: point },
            ['position', 'radius'],
            'position is the center; radius holds the horizontal and vertical radii.'
        ),
        shapeKind('line', { start: point, end: point }, ['start', 'end']),
        shapeKind('pen', { points: { type: 'array', items: point, minItems: 1 } }, ['points']),
        shapeKind(
            'text',
            {
                position: point,
                value: { type: 'string', description: 'The text shown.' },
                template: {
                    type: 'string',
                    description: 'Text with ${ID or key} parts that show variables; sets value.'
                },
                fontSize: { type: 'number', exclusiveMinimum: 0 },
                fontColor: color
            },
            ['position', 'value']
        ),
        shapeKind(
            'instance',
            {
                componentId: { type: 'string' },
                position: point,
                overrides: {
                    type: 'object',
                    description: 'Prop ID to its value, or to {"variableId": ID or key}.'
                }
            },
            ['componentId', 'position'],
            'An instance of a component the document has.'
        )
    ]
};

const TOOLS = [
    {
        name: 'addVariable',
        description: 'Adds a variable: a named value shapes may follow.',
        input_schema: {
            type: 'object',
            properties: {
                key: { type: 'string' },
                name: { type: 'string', description: 'Unique, without {, } or $.' },
                type: { type: 'string', enum: ['color', 'number', 'text', 'boolean'] },
                value: { description: 'A value of the type; a color is #rrggbb.' }
            },
            required: ['key', 'name', 'type', 'value']
        }
    },
    {
        name: 'addShape',
        description: 'Adds a shape on top of the others.',
        input_schema: {
            type: 'object',
            properties: { key: { type: 'string' }, shape: SHAPE },
            required: ['key', 'shape']
        }
    },
    {
        name: 'addGroup',
        description: 'Groups shapes, so they are selected and moved as one.',
        input_schema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                shapes: {
                    type: 'array',
                    items: { type: 'string', description: 'A shape ID or key.' },
                    minItems: 2
                },
                rotation: { type: 'number' }
            },
            required: ['name', 'shapes']
        }
    }
];

/** The first message of a request: the document, cached for a repair, any image, then the words. */
export function startConversation({ task, prompt, context, image }: AiRequest): Conversation {
    return {
        task,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `<document>\n${JSON.stringify(context)}\n</document>`,
                        cache_control: { type: 'ephemeral' }
                    },
                    ...(image
                        ? [
                              {
                                  type: 'image',
                                  source: {
                                      type: 'base64',
                                      media_type: image.mediaType,
                                      data: image.data
                                  }
                              }
                          ]
                        : []),
                    { type: 'text', text: prompt }
                ]
            }
        ]
    };
}

/**
 * The conversation with the model's answer, unchanged, and the editor's problem
 * with it, asking for the whole change again.
 */
export function repairConversation(
    conversation: Conversation,
    content: Block[],
    { operation, problem }: Problem
): Conversation {
    const result = (index: number) => {
        if (index === operation) {
            return { content: problem, is_error: true };
        }

        return operation !== undefined && index < operation
            ? { content: 'Valid.' }
            : { content: 'Not checked.', is_error: true };
    };

    return {
        ...conversation,
        messages: [
            ...conversation.messages,
            { role: 'assistant', content },
            {
                role: 'user',
                content: [
                    ...content
                        .filter((block) => block.type === 'tool_use')
                        .map((use, index) => ({
                            type: 'tool_result',
                            tool_use_id: use.id,
                            ...result(index)
                        })),
                    {
                        type: 'text',
                        text: operation === undefined ? `${problem}\n${REPAIR}` : REPAIR
                    }
                ]
            }
        ]
    };
}

const messagesBody = ({ task, messages }: Conversation) => ({
    model: TASKS[task].model,
    max_tokens: TASKS[task].maxTokens,
    stream: true,
    output_config: { effort: TASKS[task].effort },
    tools: TOOLS,
    system: [{ type: 'text', text: INSTRUCTIONS, cache_control: { type: 'ephemeral' } }],
    messages
});

/** Reads a stream of server-sent events into the JSON each carries. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (let read = await reader.read(); !read.done; read = await reader.read()) {
        buffer += decoder.decode(read.value, { stream: true }).replace(/\r\n?/g, '\n');

        let end = buffer.indexOf('\n\n');

        while (end >= 0) {
            const data = buffer
                .slice(0, end)
                .split('\n')
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice('data:'.length).trimStart())
                .join('\n');

            buffer = buffer.slice(end + 2);
            end = buffer.indexOf('\n\n');
            if (data) {
                yield JSON.parse(data) as StreamEvent;
            }
        }
    }
}

const tokens = (usage: ProviderUsage | undefined) =>
    (usage?.input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0);

/** Reads a tool's input once its block ends; one the provider cut short is empty. */
function toolInput(json: string): Record<string, unknown> {
    try {
        const input: unknown = JSON.parse(json || '{}');

        return input && typeof input === 'object' && !Array.isArray(input)
            ? (input as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

/** Calls the provider for each task's model with plain fetch, holding the key. */
export function anthropicProvider({
    apiKey,
    fetch = globalThis.fetch
}: {
    apiKey: string;
    fetch?: typeof globalThis.fetch;
}) {
    return {
        /**
         * Sends the conversation and streams the answer to `on`, each operation as
         * the model finishes it. Throws when the provider fails or `signal` aborts.
         */
        async turn(conversation: Conversation, signal: AbortSignal, on: TurnHandlers) {
            const response = await fetch(MESSAGES_URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': API_VERSION
                },
                body: JSON.stringify(messagesBody(conversation)),
                signal
            });

            if (!response.ok || !response.body) {
                throw new Error(
                    `The provider answered ${response.status}: ${await response.text()}`
                );
            }

            const turn: Turn = { content: [], stopReason: '' };
            const json = new Map<number, string>();
            const usage = { inputTokens: 0, outputTokens: 0 };

            for await (const event of readEvents(response.body)) {
                const index = event.index ?? 0;
                const block = turn.content[index];

                switch (event.type) {
                    case 'message_start':
                        usage.inputTokens = tokens(event.message?.usage);
                        usage.outputTokens = event.message?.usage?.output_tokens ?? 0;
                        on.usage({ ...usage });
                        break;
                    case 'content_block_start':
                        if (event.content_block) {
                            turn.content[index] = { ...event.content_block };
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
                            on.operation({ ...(block.input as object), op: block.name });
                        }
                        if (block?.type === 'text' && String(block.text).trim()) {
                            on.message(String(block.text));
                        }
                        break;
                    case 'message_delta':
                        turn.stopReason = event.delta?.stop_reason ?? turn.stopReason;
                        usage.outputTokens = event.usage?.output_tokens ?? usage.outputTokens;
                        if (tokens(event.usage) > 0) {
                            usage.inputTokens = tokens(event.usage);
                        }
                        on.usage({ ...usage });
                        break;
                    case 'error':
                        throw new Error(`The provider failed: ${event.error?.type ?? 'unknown'}`);
                }
            }

            return turn;
        }
    };
}

export type AiProvider = ReturnType<typeof anthropicProvider>;
