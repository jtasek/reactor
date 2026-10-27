import { frameParents } from './frameState';
import { screenViewName } from './screenViews';
import type { Document, InstanceShape, VariableContext } from './types';

export interface ModeAddress {
    simulation?: VariableContext;
    viewId?: string;
    screenId?: string;
    frameId?: string;
    /** Outer instances precede inner instances; source-frame ancestry is not inherited. */
    instances?: readonly InstanceShape[];
    session?: VariableContext;
    sessionScreenId?: string;
}

function modeChoice(
    document: Document,
    dimensionId: string,
    modeId: string,
    source: string,
    problems: string[]
) {
    const dimension = document.dimensions[dimensionId];

    if (!dimension) {
        problems.push(`${source}: dimension ${dimensionId} is unavailable.`);

        return undefined;
    }

    if (!dimension.modes[modeId]) {
        problems.push(
            `${source}: mode ${modeId} is unavailable; using ${dimension.modes[dimension.defaultModeId].name}.`
        );

        return dimension.defaultModeId;
    }

    return modeId;
}

/** Pure mode-context resolution. Never repair missing authored references while reading. */
export function resolveModes(document: Document, address: ModeAddress = {}) {
    const modes: Record<string, string> = {};
    const sources: Record<string, string> = {};
    const problems: string[] = [];
    const parents = frameParents(document.frames);
    const frames: string[] = [];

    for (let id = address.frameId; id && document.frames[id]; id = parents.get(id)) {
        frames.unshift(id);
    }

    const candidate = document.frames[address.viewId ?? address.frameId ?? ''];
    const frameScreenId = frames.find((id) => document.frames[id]?.kind === 'screen');
    const view =
        candidate?.kind === 'view' && (!frameScreenId || candidate.screenId === frameScreenId)
            ? candidate
            : undefined;
    const screenId = frameScreenId ?? view?.screenId ?? address.screenId;
    const screen = document.frames[screenId ?? ''];

    Object.values(document.dimensions).forEach((dimension) => {
        modes[dimension.id] = dimension.defaultModeId;
        sources[dimension.id] = 'Dimension default';
    });

    const apply = (overrides: VariableContext | undefined, source: string) => {
        Object.entries(overrides ?? {}).forEach(([dimensionId, modeId]) => {
            const chosen = modeChoice(document, dimensionId, modeId, source, problems);

            if (chosen === undefined) {
                return;
            }

            modes[dimensionId] = chosen;
            sources[dimensionId] = source;
        });
    };

    apply(address.simulation, 'Local simulation');
    apply(screen?.modeOverrides, `Screen ${screen?.name}`);
    apply(view?.modeOverrides, view ? `View ${screenViewName(document, view)}` : 'View');
    if (!address.sessionScreenId || address.sessionScreenId === screenId) {
        apply(address.session, 'Prototype session');
    }
    frames
        .filter((id) => id !== screenId && id !== view?.id)
        .forEach((id) => {
            const frame = document.frames[id];
            apply(frame.modeOverrides, `Frame ${frame.name}`);
        });
    address.instances?.forEach((instance) => {
        apply(instance.modeOverrides, `Instance ${instance.name}`);
    });

    return { modes, sources, problems };
}

/** Entering a component's source artwork inherits its placed instance, not source parents. */
export function instanceModes(
    document: Document,
    inherited: VariableContext,
    instance: InstanceShape,
    problems: string[] = []
): VariableContext {
    const modes = { ...inherited };
    Object.entries(instance.modeOverrides ?? {}).forEach(([dimensionId, modeId]) => {
        const chosen = modeChoice(
            document,
            dimensionId,
            modeId,
            `Instance ${instance.name}`,
            problems
        );

        if (chosen !== undefined) {
            modes[dimensionId] = chosen;
        }
    });

    return modes;
}
