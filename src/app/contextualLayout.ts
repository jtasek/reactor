import type { Document, Frame, Shape, VariableContext } from './types';
import { resolveModes, type ModeAddress } from './inheritedModes';
import { resolveVariable, variableDefinition } from './variableResolver';
import { variableContext } from './variableModes';
import { acceptsFrameNumber, FRAME_NUMBER_KEYS, writeFrameNumber } from './frameVariables';
import { projectFrameLayout } from './frameLayout';

export const NUMBER_MODE_SUPPORT =
    'In Screen views and Preview, number modes support stack gap, padding and fixed frame/rectangle sizes. Other numeric properties and component sizes currently use base values.';

const hasModes = (document: Pick<Document, 'variables'>, id: string | undefined) => {
    const variable = id ? document.variables[id] : undefined;
    const definition = variable && variableDefinition(variable, document.variables);

    return definition?.type === 'number' && definition.dimensionId !== undefined;
};

/** Whether any frame or rectangle size follows a number variable that varies by mode. */
export const hasNumericLayout = (document: Pick<Document, 'frames' | 'shapes' | 'variables'>) =>
    Object.values(document.frames).some((frame) =>
        Object.values(frame.bindings ?? {}).some((id) => hasModes(document, id))
    ) ||
    Object.values(document.shapes).some(
        (shape) =>
            shape.type === 'rectangle' &&
            (hasModes(document, shape.bindings?.width) ||
                hasModes(document, shape.bindings?.height))
    );

/** One shared geometry projection for view drawing, interaction, thumbnails and Preview. */
export function projectContextualLayout(document: Document, address: ModeAddress = {}) {
    const modeProblems: Record<string, string> = {};
    const inputs = contextualDocument(document, address, modeProblems);
    const layout = projectFrameLayout(inputs);
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
        modeProblems,
        frameSizes: { ...frameSizes, ...layout.frameSizes },
        shapeSizes: { ...shapeSizes, ...layout.shapeSizes }
    };
}

/** Apply supported numeric inputs before layout. Returned records are local projections only. */
export function contextualDocument(
    document: Document,
    address: ModeAddress = {},
    problems: Record<string, string> = {}
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
    const componentMembers = new Set(
        Object.values(document.components).flatMap((component) => component.shapesIds)
    );
    const shapes = Object.fromEntries(
        Object.values(document.shapes).map((source) => {
            if (
                source.type !== 'rectangle' ||
                componentMembers.has(source.id) ||
                (!source.bindings?.width && !source.bindings?.height) ||
                !document.frames[source.parentFrameId ?? '']?.stack
            ) {
                return [source.id, source];
            }

            const context = contextFor(source.parentFrameId);
            const shape: Shape = { ...source, size: { ...source.size } };

            (['width', 'height'] as const).forEach((key) => {
                const id = source.bindings?.[key];

                if (!id) {
                    return;
                }

                const value = valueFor(id, context);

                if (
                    typeof value !== 'number' ||
                    value <= 0 ||
                    (source.sizing?.[key]?.mode ?? 'fixed') !== 'fixed'
                ) {
                    problems[source.id] =
                        `${source.name}: ${key} mode value is unavailable or invalid; using the authored value.`;

                    return;
                }

                shape.size[key] = value;
                delete shape.bounds;
            });

            return [shape.id, shape];
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
