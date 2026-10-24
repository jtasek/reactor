import type { Document, Frame } from './types';
import { untracked } from './untracked';

/** Missing parents and every edge inside a cycle are roots in the local view only. */
export function frameParents(frames: Record<string, Frame>) {
    const parents = new Map<string, string | undefined>();
    const done = new Set<string>();

    for (const id of Object.keys(frames)) {
        const path: string[] = [];
        const visited = new Map<string, number>();
        let current: string | undefined = id;

        while (current !== undefined && Object.hasOwn(frames, current) && !done.has(current)) {
            const cycle = visited.get(current);

            if (cycle !== undefined) {
                path.slice(cycle).forEach((member) => parents.set(member, undefined));
                break;
            }

            visited.set(current, path.length);
            path.push(current);
            const parent: string | undefined = frames[current].parentFrameId;
            parents.set(
                current,
                parent !== undefined &&
                    Object.hasOwn(frames, parent) &&
                    frames[parent].kind !== 'view'
                    ? parent
                    : undefined
            );
            current = parent;
        }

        path.forEach((member) => done.add(member));
    }

    return parents;
}

/** The source of an inherited restriction; absent means visible or editable. */
export interface FrameState {
    hiddenBy?: string;
    lockedBy?: string;
}

/** Resolve once per document change; positions and sizes do not affect inherited state. */
export function projectFrameStates(frames: Record<string, Frame>): Record<string, FrameState> {
    const parents = frameParents(frames);
    const states = new Map<string, FrameState>();

    for (const id of Object.keys(frames)) {
        const path: string[] = [];
        let current: string | undefined = id;

        while (current !== undefined && !states.has(current)) {
            path.push(current);
            current = parents.get(current);
        }

        for (const child of path.reverse()) {
            const parent = parents.get(child);
            const inherited = parent === undefined ? undefined : states.get(parent);
            states.set(child, {
                hiddenBy: inherited?.hiddenBy ?? (!frames[child].visible ? child : undefined),
                lockedBy: inherited?.lockedBy ?? (frames[child].locked ? child : undefined)
            });
        }
    }

    return Object.fromEntries(states);
}

/** Plain hydrated documents have not evaluated Overmind's derived fields yet. */
export const frameStatesOf = (document: Pick<Document, 'frames' | 'frameStates'>) =>
    typeof document.frameStates === 'object'
        ? document.frameStates
        : projectFrameStates(document.frames);

export function frameState(
    document: Pick<Document, 'frames' | 'frameStates'>,
    id: string | undefined
) {
    if (id === undefined) {
        return undefined;
    }

    const states = frameStatesOf(document);

    return Object.hasOwn(states, id) ? states[id] : undefined;
}

export const isFrameVisible = (document: Document, id: string) =>
    Object.hasOwn(document.frames, id) && frameState(document, id)?.hiddenBy === undefined;

export const isFrameLocked = (document: Document, id: string) =>
    document.locked || frameState(document, id)?.lockedBy !== undefined;

export function lockedFrameForShapes(document: Document, ids: string[]) {
    const states = frameStatesOf(document);

    return ids.some(
        (id) => states[document.shapes[id]?.parentFrameId ?? '']?.lockedBy !== undefined
    );
}

/** Shapes a hidden frame holds cannot stay selected, as hiding a shape unselects it. */
export function unselectHiddenFrameShapes(document: Document) {
    const states = frameStatesOf(document);

    if (!Object.values(states).some((state) => state.hiddenBy !== undefined)) {
        return;
    }

    Object.values(untracked(document).shapes)
        .filter(
            (shape) => shape.selected && states[shape.parentFrameId ?? '']?.hiddenBy !== undefined
        )
        .forEach((shape) => {
            document.shapes[shape.id].selected = false;
        });
}
