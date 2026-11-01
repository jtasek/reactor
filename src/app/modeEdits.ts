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

/** Snapshot manual/explicit modes; width-selected modes resolve against the Preview viewport. */
/** The Screen view a preview launches from: the selected view, or the view under the pointer. */
function launchView(state: Context['state']) {
    const document = state.currentDocument;
    const selected = document.frames[document.selectedFrameId ?? ''];
    const viewId =
        selected?.kind === 'view' ? selected.id : state.events.pointer.screenView?.viewId;
    const view = selected?.kind === 'screen' ? undefined : document.frames[viewId ?? ''];

    return { selected, view };
}

/** A Prototype session applies its modes to every screen, so it starts from the launch view's
 * own choices only. Dimension defaults and the start Screen's overrides stay with their Screens. */
export function prototypeModes(state: Context['state']) {
    const seed = previewModes(state);
    const { view } = launchView(state);
    if (view?.kind !== 'view') {
        return seed;
    }
    const { dimensions } = state.currentDocument;

    return {
        ...seed,
        modes: Object.fromEntries(
            Object.entries(view.modeOverrides ?? {}).filter(
                ([dimensionId, modeId]) => dimensions[dimensionId]?.modes[modeId]
            )
        )
    };
}

export function previewModes(state: Context['state']) {
    const document = state.currentDocument;
    const { selected, view } = launchView(state);
    const screenId = view?.screenId ?? (selected?.kind === 'screen' ? selected.id : undefined);
    if (view?.kind !== 'view') {
        return { modes: {}, ...(screenId ? { screenId } : {}) };
    }

    const modes = resolveModes(document, {
        simulation: state.previewModes[document.id],
        viewId: view?.id,
        screenId
    }).modes;

    const screen = document.frames[screenId ?? ''];
    const fixedModes = Object.fromEntries(
        Object.entries(modes).filter(
            ([dimensionId]) =>
                document.dimensions[dimensionId]?.selection !== 'width' ||
                Object.hasOwn(screen?.modeOverrides ?? {}, dimensionId) ||
                Object.hasOwn(view.modeOverrides ?? {}, dimensionId)
        )
    );

    return {
        modes: fixedModes,
        ...(screenId ? { screenId } : {}),
        viewport: { ...view.size },
        ...(view.layoutId ? { layoutId: view.layoutId } : {}),
        ...(view.layoutMode ? { layoutMode: view.layoutMode } : {})
    };
}
