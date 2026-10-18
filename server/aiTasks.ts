/** What each task asks of a model, the same for every provider. */
const TASKS = {
    edit: { maxTokens: 16_000 }
} as const;

export type AiTask = keyof typeof TASKS;

export const isAiTask = (value: unknown): value is AiTask =>
    typeof value === 'string' && Object.hasOwn(TASKS, value);

export const taskMaxTokens = (task: AiTask) => TASKS[task].maxTokens;

/** What a person asked for, with the document as the editor sends it and an image they attached. */
export interface AiRequest {
    task: AiTask;
    prompt: string;
    context: object;
    image?: { mediaType: string; data: string };
}

/** Why the editor refused an answer: the operation, by its place among the answer's, and the problem. */
export interface Problem {
    operation?: number;
    problem: string;
}

/** One operation the model proposed, as a call of the tool named after it. */
export interface ToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
}

/** A model's answer: its calls, and its message in the provider's own form, sent back unchanged. */
export interface Answer {
    calls: ToolCall[];
    message: unknown;
}

/** A request, and each earlier answer with the editor's problem, which a repair sends again. */
export interface Conversation {
    request: AiRequest;
    repairs: Array<{ answer: Answer; problem: Problem }>;
}

export interface Usage {
    inputTokens: number;
    outputTokens: number;
}

/** What the model answered and why it stopped: done, refused, or cut short by its length. */
export interface Turn {
    answer: Answer;
    stop: 'done' | 'refused' | 'incomplete';
}

/** Told each operation and message as the model finishes it, and the tokens used so far. */
export interface TurnHandlers {
    operation(operation: object): void;
    message(text: string): void;
    usage(usage: Usage): void;
}

/** A model provider the gateway sends conversations to. */
export interface AiProvider {
    /** The model a task runs on. */
    model(task: AiTask): string;
    /**
     * Sends the conversation and streams the answer to `on`, each operation as the
     * model finishes it. Throws when the provider fails or `signal` aborts.
     */
    turn(conversation: Conversation, signal: AbortSignal, on: TurnHandlers): Promise<Turn>;
}

export const INSTRUCTIONS = `You change a Reactor design document by calling tools: each call is one operation.
Reactor draws shapes on a canvas measured in pixels, with x to the right and y down. The person's
message starts with the document's records as JSON: its shapes, groups, variables and components,
each under its ID.

- Make the whole change in one answer, calling the tools in order. An operation may refer only to
  an ID the document has, or to the key of a record an earlier call of this answer adds.
- Give each new shape and variable a short key of your own; later calls use it as an ID.
- To change or delete what the document has, name it by its ID. Change each record in one call at
  most, giving only the fields that change, and refer to nothing you delete. Locked records stay.
- Colors are #rrggbb. A shape's property may follow a variable of its kind: its bindings map the
  property's key, such as fill, to the variable's ID or key. Setting the property, even to the
  value it has, stops it following the variable unless bindings names it again; changing the
  variable changes every shape following it.
- A group needs two or more shapes, each in no other group.
- Do only what was asked, and leave the rest of the document as it is.
- When the tools cannot make the change, say why in one sentence and call none.`;

const REPAIR = `None of these operations were applied. Call the tools again with every operation of
the corrected change, from the first.`;

/** The person's message: the document, then their words. */
export const documentText = ({ context }: AiRequest) =>
    `<document>\n${JSON.stringify(context)}\n</document>`;

/** What the editor tells the model of each call of a refused answer, and then what to do. */
export function repairReply({ calls }: Answer, { operation, problem }: Problem) {
    const result = (index: number) => {
        if (index === operation) {
            return { content: problem, isError: true };
        }

        return operation !== undefined && index < operation
            ? { content: 'Valid.', isError: false }
            : { content: 'Not checked.', isError: true };
    };

    return {
        results: calls.map(({ id }, index) => ({ id, ...result(index) })),
        text: operation === undefined ? `${problem}\n${REPAIR}` : REPAIR
    };
}

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

/** Every field an update may change, of any type of shape, each as when adding one. */
const SHAPE_CHANGES: Record<string, object> = {};

SHAPE.anyOf.forEach(({ properties }) =>
    Object.entries(properties).forEach(([field, schema]) => {
        const known = SHAPE_CHANGES[field];

        if (field === 'type' || field === 'componentId' || known === schema) {
            return;
        }
        SHAPE_CHANGES[field] = known ? { anyOf: [known, schema] } : schema;
    })
);

/** One tool per kind of operation, each with a JSON schema of its input. */
export const TOOLS = [
    {
        name: 'addVariable',
        description: 'Adds a variable: a named value shapes may follow.',
        parameters: {
            type: 'object',
            properties: {
                key: { type: 'string' },
                name: { type: 'string', description: 'Unique, without {, } or $.' },
                type: { type: 'string', enum: ['color', 'number', 'text', 'boolean'] },
                value: {
                    description:
                        'A value of the type; a color is #rrggbb. Retained as fallback when following an alias.'
                },
                darkValue: {
                    type: 'string',
                    description:
                        'Optional #rrggbb Dark theme value for a color; otherwise uses its default.'
                },
                alias: {
                    type: 'string',
                    description: 'Optional same-type source ID or earlier variable key; no cycles.'
                }
            },
            required: ['key', 'name', 'type', 'value']
        }
    },
    {
        name: 'addShape',
        description: 'Adds a shape on top of the others.',
        parameters: {
            type: 'object',
            properties: { key: { type: 'string' }, shape: SHAPE },
            required: ['key', 'shape']
        }
    },
    {
        name: 'addGroup',
        description: 'Groups shapes, so they are selected and moved as one.',
        parameters: {
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
    },
    {
        name: 'updateShape',
        description: 'Changes fields of a shape the document has. Its type cannot change.',
        parameters: {
            type: 'object',
            properties: {
                shape: { type: 'string', description: 'The shape’s ID.' },
                changes: {
                    type: 'object',
                    description:
                        'Only the fields that change, each as when adding a shape of its type.',
                    properties: SHAPE_CHANGES
                }
            },
            required: ['shape', 'changes']
        }
    },
    {
        name: 'deleteShapes',
        description: 'Deletes shapes the document has, and the groups this leaves empty.',
        parameters: {
            type: 'object',
            properties: {
                shapes: {
                    type: 'array',
                    items: { type: 'string', description: 'A shape ID.' },
                    minItems: 1
                }
            },
            required: ['shapes']
        }
    },
    {
        name: 'deleteGroup',
        description: 'Ungroups a group the document has, keeping its shapes.',
        parameters: {
            type: 'object',
            properties: { group: { type: 'string', description: 'The group’s ID.' } },
            required: ['group']
        }
    },
    {
        name: 'updateVariable',
        description:
            'Renames a variable the document has or changes its value, which the shapes following it take.',
        parameters: {
            type: 'object',
            properties: {
                variable: { type: 'string', description: 'The variable’s ID.' },
                name: { type: 'string', description: 'Unique, without {, } or $.' },
                value: {
                    description:
                        'A value of its type; a color is #rrggbb. Setting this alone stops following its alias.'
                },
                darkValue: {
                    type: ['string', 'null'],
                    description:
                        'Color only: #rrggbb Dark theme value; null restores default fallback.'
                },
                alias: {
                    type: ['string', 'null'],
                    description:
                        'Same-type source ID or earlier variable key; null detaches to the resolved value. No cycles.'
                }
            },
            required: ['variable']
        }
    },
    {
        name: 'deleteVariable',
        description: 'Deletes a variable the document has; what followed it keeps its value.',
        parameters: {
            type: 'object',
            properties: { variable: { type: 'string', description: 'The variable’s ID.' } },
            required: ['variable']
        }
    }
];

/** A tool call as the gateway streams it: an operation named after its tool. */
export const callOperation = ({ name, input }: ToolCall) => ({ ...input, op: name });

/** Reads a tool's input once the model finished it; one cut short or not an object is empty. */
export function toolInput(json: string): Record<string, unknown> {
    try {
        const input: unknown = JSON.parse(json || '{}');

        return input && typeof input === 'object' && !Array.isArray(input)
            ? (input as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

/**
 * Reads a stream of server-sent events into the JSON each carries, until the
 * stream ends or sends `[DONE]`.
 */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
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
            if (data === '[DONE]') {
                await reader.cancel();

                return;
            }
            if (data) {
                yield JSON.parse(data);
            }
        }
    }
}

/** The body a provider streams its answer in; throws with what it said when it refused the request. */
export async function streamedBody(response: Response): Promise<ReadableStream<Uint8Array>> {
    if (!response.ok || !response.body) {
        throw new Error(`The provider answered ${response.status}: ${await response.text()}`);
    }

    return response.body;
}
