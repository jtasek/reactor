import type { Document, Frame, Shape, Variable } from './types';
import { resolveVariable, variableDefinition } from './variableResolver';

export const FRAME_NUMBER_KEYS = ['width', 'height', 'gap', 'padding'] as const;
export type FrameNumberKey = (typeof FRAME_NUMBER_KEYS)[number];

export function supportsNumberModes(
    document: Document,
    shape: Shape,
    key: string,
    variable: Variable
) {
    const definition = variableDefinition(variable, document.variables);

    if (definition.type !== 'number' || definition.dimensionId === undefined) {
        return true;
    }

    if (['fontSize', 'wrapWidth'].includes(key)) {
        return shape.type === 'text';
    }
    if (['cornerRadius', 'opacity'].includes(key)) {
        return true;
    }

    return (
        shape.type === 'rectangle' &&
        (key === 'width' || key === 'height') &&
        (shape.sizing?.[key]?.mode ?? 'fixed') === 'fixed'
    );
}

/** A top-level Screen is drawn at each view's size, so its own size cannot follow a variable. */
const screenSizedByViews = (frame: Frame) =>
    frame.kind === 'screen' && frame.parentFrameId === undefined;

export function frameNumber(frame: Frame, key: FrameNumberKey): number | undefined {
    return key === 'width' || key === 'height' ? frame.size[key] : frame.stack?.[key];
}

export function acceptsFrameNumber(frame: Frame, key: FrameNumberKey, value: number) {
    if (!Number.isFinite(value) || frame.kind === 'view') {
        return false;
    }

    return key === 'width' || key === 'height'
        ? !screenSizedByViews(frame) &&
              value >= 1 &&
              (frame.sizing?.[key]?.mode ?? 'fixed') === 'fixed'
        : Boolean(frame.stack) && value >= 0;
}

export function writeFrameNumber(frame: Frame, key: FrameNumberKey, value: number) {
    if (!acceptsFrameNumber(frame, key, value)) {
        return;
    }

    if (key === 'width' || key === 'height') {
        frame.size = { ...frame.size, [key]: value };

        return;
    }

    frame.stack = { ...frame.stack!, [key]: value };
}

/** Definition edits update held base values; a manual edit or deletion detaches a binding. */
export function updateFrameVariables(
    frames: Record<string, Frame>,
    variables: Record<string, Variable>,
    before: Record<string, Variable>
) {
    Object.values(frames).forEach((frame) => {
        FRAME_NUMBER_KEYS.forEach((key) => {
            const id = frame.bindings?.[key];
            const previous = id ? before[id] : undefined;

            if (!id || previous?.type !== 'number') {
                return;
            }

            const oldValue = resolveVariable(previous, before);
            const variable = variables[id];

            if (variable?.type !== 'number' || frameNumber(frame, key) !== oldValue) {
                delete frame.bindings![key];

                return;
            }

            const value = resolveVariable(variable, variables);

            if (typeof value === 'number') {
                writeFrameNumber(frame, key, value);
            }
        });
    });
}
