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
message starts with the document's records as JSON: its frames (screens, Screen views and alternate layouts), shapes, groups, variables and components,
each under its ID.

SCREENSHOT RECREATION: prefer composeScreen for a complete screen. Inspect the whole image
from top to bottom before composing. Include EVERY heading, paragraph, small caption, footer,
button and input; do not stop after the first control. Read each control's exact label and hint.
composeScreen takes ordered content, padding and gap; Reactor calculates vertical positions.
Use gapBefore for larger spaces between sections. Text fills the available column width and wraps.
Keep font sizes and spacing close to the screenshot. Use color variable IDs when available.
Each control declares kind button or input, label and placeholder (empty for buttons).
Omit componentId when the library has only one matching role; otherwise choose its ID. These become
actual property overrides; do not repeat button labels as separate text items.
Input labels drawn ABOVE the input need a preceding text item; the control label preserves semantics.
Put bottom captions in footer, not in content. Use lower-level tools for non-column artwork.
Controls keep the supplied component's natural size, shown in context.size. Choose that component
when suitable; draw unavailable controls using rectangles and text. Do not invent component IDs.
The compiler creates the screen, one view, background, bindings and labeled component instances.
Use addScreen/addFrame/addShape for artwork that needs lower-level capabilities. Do not create
variables with existing names or add another frame/view for the same composed screen.

- Make the whole change in one answer, calling the tools in order. An operation may refer only to
  an ID the document has, or to the key of a record an earlier call of this answer adds.
- Give each new frame, shape and variable a short key of your own; later calls use it as an ID.
- Inside addScreen, artwork keys are local to that screen, not persistent document IDs. They
  must be unique within its shapes array, but may match existing artwork IDs or other screens'
  local keys. Do not reference those local keys from other calls. The screen key remains a
  unique batch key. Component IDs, exposed property IDs and variable IDs always keep their meaning.
- Component props describe their type, source defaultValue and optional variableId. Set instance
  overrides by exposed property id, not by display label or source shape id. interaction maps
  semantic role fields (such as label) to those property ids; role describes their source values.
- Variable value is its authored base; resolved.value is the effective value in resolution's
  named context. Keep bindings when matching that context. Other Screen views may resolve
  differently. Never copy a resolved value into the variable merely to preserve its appearance.
- To change or delete what the document has, name it by its ID. Change each record in one call at
  most, giving only the fields that change, and refer to nothing you delete. Locked records stay.
- Colors are #rrggbb. A shape's property may follow a variable of its kind: its bindings map the
  property's key, such as fill, to the variable's ID or key. Setting the property, even to the
  value it has, stops it following the variable unless bindings names it again; changing the
  variable changes every shape following it.
- Use addFrame with kind screen for a shared screen definition. It creates one initial Screen view
  unless the batch adds explicit views for it. Use kind view with screenId for a canvas placement;
  every view is equal, has its own name/position/size, and cannot contain artwork.
- Put artwork inside the screen (or its alternate layout) using shape.parentFrameId. Coordinates
  are absolute within the source tree: for a screen at x=100, a 24px inset starts at x=124.
  Do not add the Screen view's canvas placement to artwork coordinates.
- An alternate layout is kind frame, screenLayout true, parentFrameId set to its screen.
  A screen's responsiveLayouts maps rule keys to {minWidth, layoutId}; thresholds are inclusive,
  unique nonnegative widths and the greatest matching width wins. A target is that screen for
  its default artwork or an alternate layout it owns. With no matching rule, use default artwork.
  When adding a screen, rules may refer forward to layout keys added later in the same answer
  (the only forward-reference exception). Updates target existing frames; add their layouts first.
- Set layoutMode auto on views to use width rules. An explicit layoutId wins over auto; preserve
  existing explicit choices unless asked to change them. Use null in updateFrame to clear a
  layoutId. Updating responsiveLayouts replaces the whole rule map: preserve rules not being edited.
- Theme and other modeOverrides stay independent of layout width rules; use existing dimension
  and mode IDs from context. Do not create dimensions or modes unless supported and requested.
- A group needs two or more shapes, each in no other group.
- Do only what was asked, and leave the rest of the document as it is.
- When the tools cannot make the change, say why in one sentence and call none.`;

const REPAIR = `None of these operations were applied. Call the tools again with every operation of
the corrected change, from the first.`;

/** Image requests need room for both vision tokens and the complete composed screen. */
export const instructionsFor = (request: AiRequest) =>
    request.image
        ? `You edit a Reactor document with tools. Context contains records under their stable IDs.
Do only what was requested. Never change the supplied library unless explicitly asked.
The context ALREADY contains the listed variables and components. Reuse their IDs; do not
add them again. Never call addVariable with an existing name. For a new single-column screen
from an image, call composeScreen with the COMPLETE content, not addFrame/addVariable.
composeScreen already creates the screen and its view; do not add either separately.
Inspect the entire image top to bottom.
Include EVERY heading, paragraph, caption, footer, button and input, preserving exact text.
Supply ordered content, padding and gap. Reactor calculates vertical positions and wraps text.
Match fontSize in pixels; use gapBefore for larger section spacing. Put bottom captions in footer.
Use kind button or input with exact label and placeholder (empty for buttons).
Omit componentId when only one library component has that role; otherwise choose the matching ID.
Controls retain context.size; padding must leave enough width. Do not repeat button text as a
text item. Input labels above fields need a preceding text item. Use color variable IDs in
all matching color fields. The compiler creates background, bindings, overrides, screen and one view.
For existing artwork or unsupported compositions use the other tools. New keys must be unique;
references name existing IDs or keys added earlier. Update/delete existing records only, once each.
Never reference a deleted record or edit a locked record. Put new artwork in its screen/frame,
not a view; raw shape coordinates are absolute. Use other tools for multi-column/decorative layouts.
Keep variable bindings when changing a bound property. Preserve independent modes and explicit
layout choices. For screenshot recreation, empty screen/view frames are not a complete answer: include the artwork.
Return the whole proposal in one answer. Say why if tools cannot do the task.`
        : INSTRUCTIONS;

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
        text: `${problem}\n${REPAIR}`
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
    parentFrameId: {
        type: 'string',
        description: 'Screen or ordinary frame ID/key owning the artwork; never a Screen view.'
    },
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
                wrapWidth: { type: 'number', minimum: 0 },
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
                    description:
                        'Prop ID to its value, or to {"variableId": ID or key}. Set these while adding the instance.',
                    additionalProperties: {
                        anyOf: [
                            { type: 'string' },
                            { type: 'number' },
                            { type: 'boolean' },
                            {
                                type: 'object',
                                properties: { variableId: { type: 'string' } },
                                required: ['variableId']
                            }
                        ]
                    }
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

// Keep common fields visible to tool-template renderers that do not expand nested anyOf branches.
// Durable operation readers still enforce the geometry required by the chosen shape type.
const ADD_SHAPE = {
    type: 'object',
    description:
        'Rectangle: top-left position and size. Circle/ellipse: center position and radius. Line: start/end. Pen: points. Text: position/value. Instance: componentId/position.',
    properties: {
        ...SHAPE_CHANGES,
        type: {
            type: 'string',
            enum: SHAPE.anyOf.flatMap(({ properties }) => properties.type.enum)
        },
        componentId: { type: 'string' },
        position: {
            ...point,
            description:
                'Required for text, instance, rectangle, circle and ellipse. Supply both x and y.'
        }
    },
    required: ['type']
};

SHAPE_CHANGES.parentFrameId = { type: ['string', 'null'] };

const size = {
    type: 'object',
    properties: { width: { type: 'number', minimum: 1 }, height: { type: 'number', minimum: 1 } },
    required: ['width', 'height']
};
const referenceMap = { type: 'object', additionalProperties: { type: 'string' } };
const layoutRules = {
    type: 'object',
    description:
        'Complete rule map. Distinct inclusive minimum widths; target the screen itself or one of its alternate layouts.',
    additionalProperties: {
        type: 'object',
        properties: { minWidth: { type: 'number', minimum: 0 }, layoutId: { type: 'string' } },
        required: ['minWidth', 'layoutId'],
        additionalProperties: false
    }
};
const frameFields = {
    kind: { type: 'string', enum: ['frame', 'screen', 'view'] },
    name: { type: 'string', minLength: 1 },
    position: point,
    size,
    parentFrameId: { type: 'string' },
    modeOverrides: referenceMap,
    bindings: referenceMap,
    layoutId: {
        type: 'string',
        description:
            'Explicit alternate layout choice for a view. Takes precedence over automatic selection.'
    },
    layoutMode: { type: 'string', enum: ['auto'] },
    responsiveLayouts: layoutRules
};

/** One tool per kind of operation, each with a JSON schema of its input. */
export const TOOLS = [
    {
        name: 'composeScreen',
        description:
            'Create a complete single-column screen from ordered content. Reactor calculates non-overlapping positions and wraps text within padding. Include all text and controls in reading order, and optionally a bottom footer. Use other drawing tools for multi-column or decorative artwork.',
        parameters: {
            type: 'object',
            properties: {
                key: { type: 'string', description: 'Unique screen reference for this proposal.' },
                name: { type: 'string' },
                x: { type: 'number', description: 'Canvas X; defaults to 0.' },
                y: { type: 'number', description: 'Canvas Y; defaults to 0.' },
                width: { type: 'number', minimum: 1 },
                height: { type: 'number', minimum: 1 },
                background: { type: 'string', description: 'Color variable ID or #rrggbb.' },
                padding: {
                    type: 'number',
                    minimum: 0,
                    description:
                        'Inset on all four sides; leave room for the natural control width.'
                },
                gap: {
                    type: 'number',
                    minimum: 0,
                    description: 'Default vertical gap between content items.'
                },
                content: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 100,
                    description:
                        'All content in top-to-bottom order. A control supplies its own visible text: do not repeat button text as a separate item. Input captions above fields are separate text items.',
                    items: {
                        anyOf: [
                            {
                                type: 'object',
                                properties: {
                                    kind: { type: 'string', enum: ['text'] },
                                    text: { type: 'string', minLength: 1 },
                                    fontSize: {
                                        type: 'number',
                                        minimum: 1,
                                        description: 'Pixel font size, matching the image.'
                                    },
                                    color: {
                                        type: 'string',
                                        description: 'Color variable ID or #rrggbb.'
                                    },
                                    gapBefore: {
                                        type: 'number',
                                        minimum: 0,
                                        description:
                                            'Optional gap before this item, replacing the default gap.'
                                    }
                                },
                                required: ['kind', 'text', 'fontSize', 'color'],
                                additionalProperties: false
                            },
                            {
                                type: 'object',
                                properties: {
                                    kind: { type: 'string', enum: ['button', 'input'] },
                                    componentId: {
                                        type: 'string',
                                        description:
                                            'Optional when only one component has this role. Otherwise choose its matching component ID; retains its natural size.'
                                    },
                                    label: {
                                        type: 'string',
                                        minLength: 1,
                                        description: 'Exact button text or input label.'
                                    },
                                    placeholder: {
                                        type: 'string',
                                        description:
                                            'Visible input hint or value; empty for buttons.'
                                    },
                                    gapBefore: { type: 'number', minimum: 0 }
                                },
                                required: ['kind', 'label', 'placeholder'],
                                additionalProperties: false
                            }
                        ]
                    }
                },
                footer: {
                    type: 'object',
                    description:
                        'Optional text anchored above the bottom padding. Do not repeat it in content.',
                    properties: {
                        text: { type: 'string', minLength: 1 },
                        fontSize: { type: 'number', minimum: 1 },
                        color: { type: 'string', description: 'Color variable ID or #rrggbb.' }
                    },
                    required: ['text', 'fontSize', 'color'],
                    additionalProperties: false
                }
            },
            required: ['key', 'name', 'width', 'height', 'background', 'padding', 'gap', 'content'],
            additionalProperties: false
        }
    },
    {
        name: 'addScreen',
        description:
            'Creates a complete screen from a screenshot in one call. Includes its visible artwork and creates one Screen view. Every supplied shape belongs to this screen automatically. Use existing components and color variables.',
        parameters: {
            type: 'object',
            properties: {
                key: {
                    type: 'string',
                    description:
                        'Unique proposal reference for this screen. Other calls may reference it.'
                },
                screen: {
                    type: 'object',
                    properties: { name: { type: 'string' }, position: point, size },
                    required: ['name', 'position', 'size']
                },
                shapes: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 100,
                    items: {
                        type: 'object',
                        properties: {
                            key: {
                                type: 'string',
                                description:
                                    'Local artwork reference, unique only within this screen. Not a component ID or property ID; no other call may reference it.'
                            },
                            shape: {
                                ...ADD_SHAPE,
                                description:
                                    'Screenshot artwork: rectangle, text or an existing component instance. Position is always required. Rectangles also need size; text needs value; instances need componentId and overrides.',
                                properties: {
                                    ...ADD_SHAPE.properties,
                                    type: {
                                        type: 'string',
                                        enum: ['rectangle', 'text', 'instance']
                                    }
                                },
                                required: ['type', 'position']
                            }
                        },
                        required: ['key', 'shape']
                    }
                }
            },
            required: ['key', 'screen', 'shapes']
        }
    },
    {
        name: 'addFrame',
        description:
            'Creates a screen definition, Screen view, alternate screen layout or ordinary frame. New screens get an initial view unless this batch adds explicit views.',
        parameters: {
            type: 'object',
            properties: {
                key: { type: 'string' },
                frame: {
                    type: 'object',
                    properties: {
                        ...frameFields,
                        screenId: {
                            type: 'string',
                            description:
                                'Required only for a Screen view: screen ID or earlier key.'
                        },
                        screenLayout: {
                            type: 'boolean',
                            enum: [true],
                            description:
                                'Alternate artwork: kind frame and parentFrameId naming its screen.'
                        }
                    },
                    required: ['kind', 'name', 'position', 'size'],
                    additionalProperties: false
                }
            },
            required: ['key', 'frame'],
            additionalProperties: false
        }
    },
    {
        name: 'updateFrame',
        description:
            'Updates an existing screen, view or frame. Responsive rules replace the complete map. Explicit view layout choices stay unchanged unless included.',
        parameters: {
            type: 'object',
            properties: {
                frame: { type: 'string', description: 'Existing frame ID, not a batch key.' },
                changes: {
                    type: 'object',
                    properties: {
                        ...frameFields,
                        parentFrameId: { type: ['string', 'null'] },
                        layoutId: { type: ['string', 'null'] },
                        layoutMode: { type: ['string', 'null'], enum: ['auto', null] },
                        responsiveLayouts: { anyOf: [layoutRules, { type: 'null' }] }
                    },
                    additionalProperties: false
                }
            },
            required: ['frame', 'changes'],
            additionalProperties: false
        }
    },
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
                dimensionId: {
                    type: 'string',
                    description:
                        'Optional existing dimension ID, for color, number or text variables.'
                },
                modeValues: {
                    type: 'object',
                    additionalProperties: { type: ['string', 'number'] },
                    description:
                        'Optional color, number or text overrides keyed by mode ID from that dimension. Missing modes use the base value.'
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
        description:
            'Adds a shape on top of the others. Include parentFrameId, bindings and instance overrides inside shape now; do not update this new key later.',
        parameters: {
            type: 'object',
            properties: { key: { type: 'string' }, shape: ADD_SHAPE },
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
        description:
            'Changes an existing document shape by ID, never a key added in this answer. Its type cannot change.',
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
                dimensionId: {
                    type: ['string', 'null'],
                    description:
                        'Color, number or text: existing dimension ID, or null to remove modes. Changing it clears old mode values.'
                },
                modeValues: {
                    type: 'object',
                    additionalProperties: { type: ['string', 'number', 'null'] },
                    description:
                        'Color, number or text overrides keyed by mode ID; null removes an override. Editing without an explicit alias detaches to literal values.'
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

/** Keep all editing operations; avoid two overlapping complete-screen schemas in image requests. */
function componentChoices(context: object, role: string) {
    const components: unknown = Reflect.get(context, 'components');
    if (!components || typeof components !== 'object') {
        return [];
    }

    return Object.entries(components).flatMap(([id, component]) => {
        const interaction: unknown =
            component && typeof component === 'object'
                ? Reflect.get(component, 'interaction')
                : undefined;

        return interaction &&
            typeof interaction === 'object' &&
            Reflect.get(interaction, 'role') === role
            ? [id]
            : [];
    });
}

export const toolsFor = (request: AiRequest) =>
    TOOLS.filter((tool) => !request.image || tool.name !== 'addScreen').map((tool) => {
        if (tool.name !== 'composeScreen') {
            return tool;
        }
        const content = tool.parameters.properties.content!;
        const [text, control] = content.items.anyOf;
        const controls = ['button', 'input'].map((role) => {
            const choices = componentChoices(request.context, role);
            const { componentId, ...properties } = control.properties;

            return {
                ...control,
                description:
                    role === 'button'
                        ? 'Clickable action or navigation with visible text. Not a text-entry field.'
                        : 'Text-entry field with a visible hint or value. Not a clickable action.',
                properties: {
                    ...properties,
                    kind: { type: 'string', enum: [role] },
                    ...(choices.length === 1
                        ? {}
                        : {
                              componentId: {
                                  ...componentId,
                                  ...(choices.length ? { enum: choices } : {})
                              }
                          })
                },
                required: [
                    'kind',
                    'label',
                    ...(role === 'input' ? ['placeholder'] : []),
                    ...(choices.length === 1 ? [] : ['componentId'])
                ]
            };
        });

        return {
            ...tool,
            parameters: {
                ...tool.parameters,
                properties: {
                    ...tool.parameters.properties,
                    content: { ...content, items: { anyOf: [text, ...controls] } }
                }
            }
        };
    });

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
