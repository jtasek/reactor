import { useAppState } from './hooks';
import { resolveModes } from './inheritedModes';
import type { Shape } from './types';
import type { Context } from './index';
import type { ModeTarget } from './modeEdits';
import { ordered } from './variableModes';
import { isReadOnly } from './documentAccess';
import { isShapeLocked } from './utils';
import { isFrameLocked } from './frameState';

/** Modes for artwork drawn in `viewId`; a focused component's members go through its instance. */
export function artworkModes(state: Context['state'], shape: Shape, viewId?: string) {
    const document = state.currentDocument;
    const focus =
        viewId && state.componentEditingReturn?.documentId === document.id
            ? state.componentEditingReturn.componentOrigin
            : undefined;
    // Only the focused component's own artwork is drawn through its instance.
    const member =
        focus !== undefined &&
        document.editingComponentId === focus.componentId &&
        Boolean(document.components[focus.componentId]?.shapesIds.includes(shape.id));
    const host = member ? document.shapes[focus.instanceId] : undefined;
    const instances = [host, shape].filter((item) => item?.type === 'instance');

    return resolveModes(document, {
        simulation: state.previewModes[document.id],
        viewId,
        frameId: host?.parentFrameId ?? shape.parentFrameId,
        instances
    });
}

/** Canvas source artwork and each placed view resolve independently, including focused masters. */
export const useArtworkModes = (shape: Shape, viewId?: string) =>
    useAppState((state) => artworkModes(state, shape, viewId).modes);

export const useModeFields = (target: ModeTarget) =>
    useAppState((state) => {
        const document = state.currentDocument;
        const frame = 'frameId' in target ? document.frames[target.frameId] : undefined;
        const shape = 'instanceId' in target ? document.shapes[target.instanceId] : undefined;
        const overrides =
            frame?.modeOverrides ?? (shape?.type === 'instance' ? shape.modeOverrides : {}) ?? {};
        const resolved = shape
            ? artworkModes(state, shape, state.events.pointer.screenView?.viewId)
            : resolveModes(document, {
                  simulation: state.previewModes[document.id],
                  frameId: frame?.id,
                  viewId:
                      frame?.kind === 'frame' ? state.events.pointer.screenView?.viewId : undefined
              });
        const dimensions = ordered(document.dimensions).map((dimension) => ({
            id: dimension.id,
            name: dimension.name,
            modes: ordered(dimension.modes),
            chosen: overrides[dimension.id] ?? '',
            effective: dimension.modes[resolved.modes[dimension.id]]?.name ?? 'Unavailable',
            source: resolved.sources[dimension.id]
        }));
        const missing = Object.keys(overrides)
            .filter((id) => !document.dimensions[id])
            .map((id) => ({
                id,
                name: `Missing dimension ${id}`,
                modes: [],
                chosen: overrides[id],
                effective: 'Unavailable',
                source: 'Missing dimension'
            }));

        return {
            dimensions: [...dimensions, ...missing],
            problems: resolved.problems,
            disabled:
                isReadOnly(state) ||
                document.locked ||
                state.events.pointer.gesture.kind !== 'idle' ||
                (frame
                    ? isFrameLocked(document, frame.id)
                    : !shape || isShapeLocked(document, shape.id))
        };
    });
