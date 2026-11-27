import type { Document, Shape, Frame } from 'src/app/types';
import { readEntity } from 'src/app/services/documentStorage';
import { TEMPLATE_PART, templateVariable } from 'src/app/variableResolver';
import { describeComponentProp } from 'src/app/componentProps';
import { effectiveRoleSettings, resolveComponentRole } from 'src/app/componentRoles';
import { resolveModes } from 'src/app/inheritedModes';
import { describeVariable } from 'src/app/variableDescription';
import { componentSource, sourceMembers } from 'src/app/componentSource';
import { dataFields, recordLabels, runnableRules } from 'src/app/data';
import { effectText, flowMachine } from 'src/app/flowMachine';
import { stateType } from 'src/app/prototypeState';

/** A transport-size budget, not a provider-specific token count. */
export const MAX_CONTEXT_BYTES = 32 * 1024;
const MAX_CONTEXT_RECORDS = 300;
/** Record names sent per entity, enough to refer to sample records. */
const MAX_RECORD_NAMES = 50;

/** What a shape keeps for the editor alone, or names elsewhere, as its ID. */
const EDITOR_FIELDS = new Set([
    'id',
    'created',
    'modified',
    'createdBy',
    'modifiedBy',
    'order',
    'children'
]);

export class ContextTooLarge extends Error {
    constructor() {
        super(
            'This context is too large. Select fewer items or shorten their text, then try again.'
        );
    }
}

const shapeContext = (shape: Shape) =>
    Object.fromEntries(
        Object.entries(readEntity('shapes', shape)).filter(([field]) => !EDITOR_FIELDS.has(field))
    );

type ShapeContext = ReturnType<typeof shapeContext>;
interface ComponentContext {
    name: string;
    size?: { width: number; height: number };
    props: Array<NonNullable<ReturnType<typeof describeComponentProp>>>;
    interaction: ReturnType<typeof effectiveRoleSettings>;
    role: ReturnType<typeof resolveComponentRole>;
    variantIds?: string[];
    responsiveVariants?: Document['components'][string]['responsiveVariants'];
    shapes: Record<string, ShapeContext>;
}

/**
 * The selection, its groups and dependencies, in drawing order. With no
 * selection, a small document and its design system remain available; a selected
 * frame keeps the design system too. Nothing is silently truncated: oversized
 * context is refused before sending it.
 */
export function documentContext(document: Document) {
    const selection = [...document.selectedShapesIds];
    const selected = new Set(selection);
    const selectedFrame = document.frames[document.selectedFrameId ?? ''];
    const selectedShape = selection.length === 1 ? document.shapes[selection[0]] : undefined;
    // Several shapes or views need separate contexts; never claim a shared resolved value.
    const resolution = resolveModes(document, {
        frameId: selectedFrame?.id ?? selectedShape?.parentFrameId,
        instances: selectedShape?.type === 'instance' ? [selectedShape] : undefined
    });
    const whole = selection.length === 0 && !selectedFrame;
    const frameSelection = new Set<string>();

    if (selectedFrame) {
        const root = selectedFrame.screenId ?? selectedFrame.id;
        frameSelection.add(root);
        // Iterate to a fixed point; malformed/cyclic remote ancestry cannot recurse forever.
        for (let previous = -1; previous !== frameSelection.size; ) {
            previous = frameSelection.size;
            Object.values(document.frames).forEach((frame) => {
                if (frameSelection.has(frame.parentFrameId ?? '')) {
                    frameSelection.add(frame.id);
                }
            });
        }
    }
    const shapeIds = new Set(whole ? document.shapesIds : selection);
    Object.values(document.shapes).forEach((shape) => {
        if (frameSelection.has(shape.parentFrameId ?? '')) {
            shapeIds.add(shape.id);
            selected.add(shape.id);
        }
    });
    const frames = new Map<string, Omit<Frame, 'id'>>();
    const dimensionIds = new Set<string>(
        selectedShape?.type === 'instance' ? Object.keys(selectedShape.modeOverrides ?? {}) : []
    );
    const groups = new Map<string, { name: string; shapes: string[] }>();
    const variables = new Map<string, ReturnType<typeof describeVariable>>();
    const components = new Map<string, ComponentContext>();
    let records = 0;

    const reserve = () => {
        if (++records > MAX_CONTEXT_RECORDS) {
            throw new ContextTooLarge();
        }
    };

    const followTemplate = (text: string) => {
        for (const [, inside, name] of text.matchAll(TEMPLATE_PART)) {
            const variable =
                inside === undefined
                    ? undefined
                    : templateVariable(document.variables, inside, name);

            if (variable) {
                addVariable(variable.id);
            }
        }
    };
    const addVariable = (id: string): void => {
        const variable = document.variables[id];

        if (!Object.hasOwn(document.variables, id) || variables.has(id)) {
            return;
        }
        reserve();
        variables.set(id, describeVariable(document, variable, resolution.modes));
        if (variable.alias !== undefined) {
            addVariable(variable.alias);
        }
        if (variable.type === 'text') {
            Object.values(variable.values).forEach(followTemplate);
        }
    };
    const addFrame = (id: string): void => {
        const frame = document.frames[id];

        if (!Object.hasOwn(document.frames, id) || frames.has(id)) {
            return;
        }
        reserve();
        const { id: frameId, ...fields } = readEntity('frames', frame);
        frames.set(frameId, fields);
        Object.values(frame.bindings ?? {}).forEach(addVariable);
        Object.keys(frame.modeOverrides ?? {}).forEach((id) => dimensionIds.add(id));
        [
            frame.parentFrameId,
            frame.screenId,
            frame.layoutId,
            ...Object.values(frame.responsiveLayouts ?? {}).map((rule) => rule.layoutId)
        ].forEach((reference) => {
            if (reference) {
                addFrame(reference);
            }
        });
    };
    if (whole) {
        Object.keys(document.frames).forEach(addFrame);
    }
    frameSelection.forEach(addFrame);
    if (selectedFrame) {
        addFrame(selectedFrame.id);
        // Other placements of the same screen, so new views can sit beside them.
        Object.values(document.frames).forEach((frame) => {
            if (frame.kind === 'view' && frameSelection.has(frame.screenId ?? '')) {
                addFrame(frame.id);
            }
        });
    }

    const followShape = (shape: Shape) => {
        if (shape.parentFrameId) {
            addFrame(shape.parentFrameId);
        }
        Object.values(shape.bindings ?? {}).forEach(addVariable);
        if (shape.type === 'text' && shape.template !== undefined) {
            followTemplate(shape.template);
        }
        if (shape.type === 'instance') {
            addComponent(shape.componentId);
            Object.values(shape.overrides).forEach((override) => {
                if (typeof override === 'object') {
                    addVariable(override.variableId);
                } else if (typeof override === 'string') {
                    followTemplate(override);
                }
            });
        }
    };
    const addComponent = (id: string): void => {
        const component = document.components[id];

        if (!Object.hasOwn(document.components, id) || components.has(id)) {
            return;
        }
        reserve();
        const interaction = effectiveRoleSettings(component);
        const bounds = componentSource(document, id)?.box;
        const source: ComponentContext = {
            name: component.name,
            ...(bounds ? { size: { width: bounds.width, height: bounds.height } } : {}),
            props: (component.props ?? []).flatMap(({ id }) => {
                const description = describeComponentProp(component, id, document);

                return description ? [description] : [];
            }),
            interaction: { ...interaction, props: { ...interaction.props } },
            role: resolveComponentRole(document, component),
            ...(component.variantIds ? { variantIds: [...component.variantIds] } : {}),
            ...(component.responsiveVariants
                ? {
                      responsiveVariants: {
                          source: component.responsiveVariants.source,
                          rules: component.responsiveVariants.rules.map((rule) => ({ ...rule }))
                      }
                  }
                : {}),
            shapes: {}
        };
        components.set(id, source);
        component.variantIds?.forEach(addComponent);
        source.shapes = Object.fromEntries(
            sourceMembers(component, document.shapes).map((shape) => {
                reserve();
                followShape(shape);

                return [shape.id, shapeContext(shape)];
            })
        );
    };

    Object.values(document.groups).forEach(({ id, name, shapesIds }) => {
        if (whole || shapesIds.some((id) => selected.has(id))) {
            reserve();
            const members = shapesIds.filter((id) => Object.hasOwn(document.shapes, id));

            groups.set(id, { name, shapes: [...members] });
            members.forEach((id) => shapeIds.add(id));
        }
    });
    const shapes = Object.fromEntries(
        document.shapesIds
            .filter((id) => shapeIds.has(id))
            .map((id) => {
                reserve();
                const shape = document.shapes[id];

                followShape(shape);

                return [id, shapeContext(shape)];
            })
    );

    // A selected frame is often where new work starts, so it keeps the design system.
    if (whole || selectedFrame) {
        Object.keys(document.variables).forEach(addVariable);
        Object.keys(document.components).forEach(addComponent);
    }
    const includesDimension = (id: string) =>
        whole ||
        selectedFrame !== undefined ||
        dimensionIds.has(id) ||
        [...variables.values()].some((variable) => variable.dimensionId === id);
    const data = Object.fromEntries(
        Object.values(document.dataEntities).map((entity) => {
            reserve();
            const names = [...recordLabels(document, entity.id)];
            const rules = runnableRules(document, entity.id).map(({ when, check, message }) => ({
                ...(when ? { when } : {}),
                check,
                message
            }));

            return [
                entity.id,
                {
                    name: entity.name,
                    ...(entity.labelFieldId ? { labelFieldId: entity.labelFieldId } : {}),
                    fields: Object.fromEntries(
                        dataFields(document, entity.id).map(
                            ({ id, name, type, required, options, targetEntityId }) => [
                                id,
                                {
                                    name,
                                    type,
                                    required,
                                    ...(type === 'choice' ? { options } : {}),
                                    ...(type === 'reference' ? { targetEntityId } : {})
                                }
                            ]
                        )
                    ),
                    ...(rules.length ? { rules } : {}),
                    recordCount: names.length,
                    records: Object.fromEntries(names.slice(0, MAX_RECORD_NAMES))
                }
            ];
        })
    );
    // Selection edits share only their scoped artwork and dependencies.
    // The whole-document chat also offers navigation authoring.
    const flow = whole ? flowContext(document, reserve) : { screens: {}, states: {} };
    const context = {
        selection,
        ...(selectedFrame ? { selectedFrameId: selectedFrame.id } : {}),
        frames: Object.fromEntries(frames),
        shapes,
        groups: Object.fromEntries(groups),
        variables: Object.fromEntries(variables),
        dimensions: Object.fromEntries(
            Object.entries(document.dimensions)
                .filter(([id]) => includesDimension(id))
                .map((entry) => {
                    reserve();

                    return entry;
                })
        ),
        resolution: {
            scope: selectedFrame ? 'frame' : selectedShape ? 'shape source' : 'document defaults',
            ...(selectedFrame ? { frameId: selectedFrame.id } : {}),
            ...(selectedShape && !selectedFrame ? { shapeId: selectedShape.id } : {}),
            modes: Object.fromEntries(
                Object.entries(resolution.modes).filter(([id]) => includesDimension(id))
            ),
            sources: Object.fromEntries(
                Object.entries(resolution.sources).filter(([id]) => includesDimension(id))
            ),
            problems: resolution.problems
        },
        components: Object.fromEntries(components),
        data,
        flow
    };

    if (new TextEncoder().encode(JSON.stringify(context)).byteLength > MAX_CONTEXT_BYTES) {
        throw new ContextTooLarge();
    }

    return context;
}

/**
 * What the chat on Flow and Prototype shares: the pages, their controls and states, and the
 * variants a control may show, without the artwork the canvas chat sends. On Prototype it
 * names the page the player shows.
 */
export function flowDocumentContext(document: Document, currentScreenId?: string) {
    let records = 0;
    const reserve = () => {
        if (++records > MAX_CONTEXT_RECORDS) {
            throw new ContextTooLarge();
        }
    };
    const flow = {
        ...flowContext(document, reserve),
        ...(currentScreenId && document.frames[currentScreenId] ? { currentScreenId } : {})
    };
    const variants = Object.values(document.components).flatMap((component) =>
        component.variantIds?.length
            ? [
                  [
                      component.id,
                      {
                          name: component.name,
                          variants: Object.fromEntries(
                              component.variantIds.map((id) => [
                                  id,
                                  document.components[id]?.name ?? id
                              ])
                          )
                      }
                  ] as const
              ]
            : []
    );
    const context = { selection: [], flow, components: Object.fromEntries(variants) };

    if (new TextEncoder().encode(JSON.stringify(context)).byteLength > MAX_CONTEXT_BYTES) {
        throw new ContextTooLarge();
    }

    return context;
}

/** The words a control shows, which people name it by, when its component links a label. */
function controlLabel(document: Document, instanceId: string) {
    const instance = document.shapes[instanceId];
    const component = instance?.type === 'instance' && document.components[instance.componentId];
    if (instance?.type !== 'instance' || !component) {
        return undefined;
    }
    const propId = effectiveRoleSettings(component, instance).props.label;
    const value = propId
        ? (instance.overrides[propId] ??
          describeComponentProp(component, propId, document)?.defaultValue)
        : undefined;

    return typeof value === 'string' && value !== instance.name ? value : undefined;
}

/** Each page's controls that can take an action, what a tap does now, and the named states. */
function flowContext(document: Document, reserve: () => void) {
    const machine = flowMachine(document);
    const screens = machine.states
        .filter((screen) => screen.available)
        .map((screen) => {
            reserve();
            const controls = [
                ...screen.transitions
                    .filter((transition) => transition.editable && !transition.shared)
                    .map((transition) => ({
                        id: transition.instanceId,
                        name: transition.control,
                        does: `${transition.event === 'enter' ? 'on Enter ' : ''}${
                            transition.effect.kind === 'go'
                                ? `opens ${transition.effect.name}`
                                : effectText(transition.effect)
                        }`
                    })),
                ...screen.idle
                    .filter((control) => control.editable)
                    .map((control) => ({ id: control.instanceId, name: control.control }))
            ];

            return [
                screen.id,
                {
                    name: screen.name,
                    controls: Object.fromEntries(
                        controls.map(({ id, ...control }) => {
                            reserve();
                            const label = controlLabel(document, id);

                            return [id, { ...control, ...(label ? { label } : {}) }];
                        })
                    )
                }
            ];
        });

    return {
        ...(machine.initial ? { startScreenId: machine.initial } : {}),
        screens: Object.fromEntries(screens),
        states: Object.fromEntries(
            Object.values(document.prototypeBooleans).map((state) => {
                reserve();

                return [
                    state.id,
                    { name: state.name, type: stateType(state), initial: state.initial }
                ];
            })
        )
    };
}
