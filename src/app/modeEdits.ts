import type { ActionWithParam, VariableContext } from './types';
import type { Context } from './index';
import { isReadOnly } from './documentAccess';
import { isFrameLocked } from './frameState';
import { isShapeLocked } from './utils';
import { resolveModes } from './inheritedModes';

export type ModeTarget = { frameId: string } | { instanceId: string };

export const setModeOverride: ActionWithParam<{
    target: ModeTarget;
    dimensionId: string;
    modeId: string | null;
}> = ({ state, effects }, { target, dimensionId, modeId }) => {
    const document = state.currentDocument;
    const entity =
        'frameId' in target ? document.frames[target.frameId] : document.shapes[target.instanceId];
    const locked =
        'frameId' in target
            ? isFrameLocked(document, target.frameId)
            : isShapeLocked(document, target.instanceId);

    if (
        !entity ||
        isReadOnly(state) ||
        document.locked ||
        locked ||
        state.events.pointer.gesture.kind !== 'idle' ||
        ('type' in entity && entity.type !== 'instance') ||
        (modeId !== null && !document.dimensions[dimensionId]?.modes[modeId])
    ) {
        return;
    }

    const current: VariableContext = entity.modeOverrides ?? {};

    if ((current[dimensionId] ?? null) === modeId) {
        return;
    }

    effects.collaboration.startBatch(document.id, { kind: 'person' });
    entity.modeOverrides = Object.fromEntries([
        ...Object.entries(current).filter(([id]) => id !== dimensionId),
        ...(modeId === null ? [] : [[dimensionId, modeId]])
    ]);
    effects.collaboration.flush();
};

/** Snapshot the selected view's screen-root modes; descendants apply afterwards in Preview. */
export function previewModes(state: Context['state']) {
    const document = state.currentDocument;
    const selected = document.frames[document.selectedFrameId ?? ''];
    const viewId =
        selected?.kind === 'view' ? selected.id : state.events.pointer.screenView?.viewId;
    const view = selected?.kind === 'screen' ? undefined : document.frames[viewId ?? ''];
    const screenId = view?.screenId ?? (selected?.kind === 'screen' ? selected.id : undefined);
    if (view?.kind !== 'view') {
        return { modes: {}, ...(screenId ? { screenId } : {}) };
    }

    const modes = resolveModes(document, {
        simulation: state.previewModes[document.id],
        viewId: view?.id,
        screenId
    }).modes;

    return {
        modes,
        ...(screenId ? { screenId } : {}),
        viewport: { ...view.size },
        ...(view.layoutId ? { layoutId: view.layoutId } : {})
    };
}
