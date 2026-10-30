import type { Document, Frame, Shape, Size, Text, InstanceShape, VariableContext } from './types';
import { untracked } from './untracked';
import type { FrameLayout } from './frameLayout';
import { resolveModes, type ModeAddress } from './inheritedModes';
import { resolveVariable, variableDefinition } from './variableResolver';
import { variableDependencies, templateVariablesIds } from './variables';
import { variableContext } from './variableModes';
import { acceptsFrameNumber, FRAME_NUMBER_KEYS, writeFrameNumber } from './frameVariables';
import { projectGeometry } from './contextualGeometry';
import { projectFrameLayout } from './frameLayout';
import { getBoundingBox } from './utils';
import { variantWidths } from './responsiveVariants';

export const NUMBER_MODE_SUPPORT =
    'Modes resolve layout, component sizes, font size, text and wrapping locally. Position and rotation bindings keep their base values.';

/** Context-dependent geometry and opt-in wrapping need local bounds, including source artwork. */
export function hasNumericLayout(
    document: Pick<Document, 'frames' | 'shapes' | 'variables' | 'components'>
) {
    const hasModes = (id: string) => {
        const variable = document.variables[id];
        if (!variable) {
            return false;
        }
        return [id, ...variableDependencies(variable, document.variables)].some((dependency) => {
            const definition =
                document.variables[dependency] &&
                variableDefinition(document.variables[dependency], document.variables);
            return (
                definition &&
                (definition.type === 'number' || definition.type === 'text') &&
                definition.dimensionId !== undefined
            );
        });
    };
    const shapes = [
        ...Object.values(document.shapes),
        ...Object.values(document.components).flatMap((component) =>
            Object.values(component.sourceShapes ?? {})
        )
    ];

    return (
        shapes.some((shape) => shape.type === 'instance' && shape.variantMode === 'auto') ||
        Object.values(document.frames).some((frame) =>
            Object.values(frame.bindings ?? {}).some(hasModes)
        ) ||
        shapes.some(
            (shape) =>
                Object.values(shape.bindings ?? {}).some(hasModes) ||
                (shape.type === 'instance' &&
                    Object.values(shape.overrides).some(
                        (override) =>
                            (typeof override === 'object' && hasModes(override.variableId)) ||
                            (typeof override === 'string' &&
                                [...templateVariablesIds(override, document.variables)].some(
                                    hasModes
                                ))
                    )) ||
                (shape.type === 'text' &&
                    (Boolean(shape.wrapWidth) ||
                        (shape.template !== undefined &&
                            [...templateVariablesIds(shape.template, document.variables)].some(
                                hasModes
                            ))))
        )
    );
}

/** One shared geometry projection for view drawing, interaction, thumbnails and Preview. */
export function projectContextualLayout(document: Document, address: ModeAddress = {}) {
    const modeProblems: Record<string, string> = {};
    const initial = contextualDocument(document, address, modeProblems);
    const firstLayout = projectFrameLayout(initial);
    const inputs = Object.keys(firstLayout.frameSizes).length
        ? contextualDocument(document, address, modeProblems, firstLayout.frameSizes)
        : initial;
    const layout = inputs === initial ? firstLayout : projectFrameLayout(inputs);
    const frameSizes = Object.fromEntries(
        Object.values(inputs.frames)
            .filter((frame) => frame.size !== document.frames[frame.id].size)
            .map((frame) => [frame.id, frame.size])
    );
    const shapeSizes = Object.fromEntries(
        Object.values(inputs.shapes).flatMap((shape) =>
            shape.type === 'rectangle' && shape !== document.shapes[shape.id]
                ? [[shape.id, shape.size]]
                : []
        )
    );

    return {
        ...layout,
        resolvedShapes: inputs === document ? undefined : inputs.shapes,
        modeProblems,
        frameSizes: { ...frameSizes, ...layout.frameSizes },
        shapeSizes: { ...shapeSizes, ...layout.shapeSizes }
    };
}

/**
 * Whether Canvas geometry depends on context: number or text modes, or wrapped text.
 * Every Shape reading `frameLayout` tracks each path its derived reads, so this reads
 * variables, the shape list and text wrap limits only, never every shape's fields.
 */
export function needsContextualGeometry(document: Document) {
    if (
        Object.values(document.variables).some(
            (variable) =>
                (variable.type === 'number' || variable.type === 'text') &&
                variable.dimensionId !== undefined
        )
    ) {
        return true;
    }
    const dependsOnContext = (shapes: Record<string, Shape>, raw: Record<string, Shape>) =>
        Object.keys(raw).some(
            (id) =>
                (raw[id].type === 'text' && Boolean((shapes[id] as Text).wrapWidth)) ||
                (raw[id].type === 'instance' &&
                    (shapes[id] as InstanceShape).variantMode === 'auto')
        );
    // Adding or removing a shape changes the list, which reruns this check.
    void document.shapesIds.length;

    return (
        dependsOnContext(document.shapes, untracked(document).shapes) ||
        Object.values(document.components).some((component) =>
            dependsOnContext(component.sourceShapes ?? {}, untracked(component).sourceShapes ?? {})
        )
    );
}

/**
 * Frames that lay shapes out together need the whole contextual projection. Otherwise
 * `renderedShape` resolves each shape on its own, so a Shape tracks only its inputs.
 */
export function canvasLayout(document: Document, simulation?: VariableContext): FrameLayout {
    if (
        Object.values(document.frames).some(
            (frame) => frame.stack || frame.sizing || Object.keys(frame.bindings ?? {}).length > 0
        )
    ) {
        return projectContextualLayout(document, { simulation });
    }

    return { ...projectFrameLayout(document), contextual: true, canvasModes: simulation };
}

/** Width a wrapped text may use: inside the frame's padding, from where it starts in a free frame. */
function availableWidthIn(parent: Frame | undefined, shape: Shape, width?: number) {
    if (!parent || parent.sizing?.width?.mode === 'hug') {
        return undefined;
    }
    const inner = (width ?? parent.size.width) - 2 * (parent.stack?.padding ?? 0);
    // A stack places its items itself; a free frame keeps the shape where it is.
    const offset = parent.stack
        ? 0
        : Math.max(0, getBoundingBox(shape).topLeft.x - parent.position.x);

    return Math.max(1, inner - offset);
}

/**
 * One shape's Canvas geometry when no frame lays shapes out together. Each Shape reads
 * only its own inputs, instead of a projection that reads, and so tracks, every shape.
 */
export function canvasShape(document: Document, source: Shape, layout: FrameLayout): Shape {
    if (source.type !== 'text' && source.type !== 'instance' && !source.bindings) {
        return source;
    }
    const modes = resolveModes(document, {
        simulation: layout.canvasModes,
        frameId: source.parentFrameId
    }).modes;
    const parent = document.frames[source.parentFrameId ?? ''];

    return projectGeometry(
        source,
        document,
        modes,
        availableWidthIn(parent, source, parent && layout.frameSizes[parent.id]?.width),
        undefined,
        undefined,
        variantWidths(document, source.parentFrameId, {}, layout.frameSizes)
    );
}

/** Apply supported numeric inputs before layout. Returned records are local projections only. */
export function contextualDocument(
    document: Document,
    address: ModeAddress = {},
    problems: Record<string, string> = {},
    availableSizes: Record<string, Size> = {}
): Pick<
    Document,
    'frames' | 'shapes' | 'groups' | 'layers' | 'components' | 'variables' | 'shapesIds'
> {
    if (!hasNumericLayout(document)) {
        return document;
    }

    const contextFor = (frameId?: string) =>
        variableContext(document, resolveModes(document, { ...address, frameId }).modes);
    const valueFor = (id: string, context: VariableContext) => {
        const variable = document.variables[id];

        return variable?.type === 'number'
            ? resolveVariable(variable, document.variables, context)
            : undefined;
    };
    const frames = Object.fromEntries(
        Object.values(document.frames).map((source) => {
            if (Object.keys(source.bindings ?? {}).length === 0) {
                return [source.id, source];
            }

            const frame: Frame = { ...source };
            const context = contextFor(frame.id);

            FRAME_NUMBER_KEYS.forEach((key) => {
                const id = source.bindings?.[key];

                if (!id) {
                    return;
                }

                const value = valueFor(id, context);

                if (typeof value !== 'number' || !acceptsFrameNumber(frame, key, value)) {
                    problems[frame.id] =
                        `${frame.name}: ${key} mode value is unavailable or invalid; using the authored value.`;

                    return;
                }

                writeFrameNumber(frame, key, value);
            });

            return [frame.id, frame];
        })
    );
    const shapes = Object.fromEntries(
        Object.values(document.shapes).map((source) => {
            const modes = resolveModes(document, {
                ...address,
                frameId: source.parentFrameId
            }).modes;
            const parent = frames[source.parentFrameId ?? ''];
            const availableWidth = availableWidthIn(
                parent,
                source,
                parent && availableSizes[parent.id]?.width
            );

            return [
                source.id,
                projectGeometry(
                    source,
                    document,
                    modes,
                    availableWidth,
                    undefined,
                    problems,
                    variantWidths({ frames }, source.parentFrameId, address, availableSizes)
                )
            ];
        })
    );

    return {
        frames,
        shapes,
        groups: document.groups,
        layers: document.layers,
        components: document.components,
        variables: document.variables,
        shapesIds: document.shapesIds
    };
}
