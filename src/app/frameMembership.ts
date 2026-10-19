import type { Document, Frame } from './types';

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
                parent !== undefined && Object.hasOwn(frames, parent) ? parent : undefined
            );
            current = parent;
        }

        path.forEach((member) => done.add(member));
    }

    return parents;
}

/** Children are explicit: geometric overlap never adopts an item. */
export function frameContents(document: Pick<Document, 'frames' | 'shapes'>, id: string) {
    const parents = frameParents(document.frames);
    const children = new Map<string, string[]>();

    parents.forEach((parent, child) => {
        if (parent !== undefined) {
            children.set(parent, [...(children.get(parent) ?? []), child]);
        }
    });

    const frames: string[] = [];
    const pending = [...(children.get(id) ?? [])];

    while (pending.length > 0) {
        const child = pending.pop()!;
        frames.push(child);
        pending.push(...(children.get(child) ?? []));
    }

    const family = new Set([id, ...frames]);
    const shapes = Object.values(document.shapes)
        .filter((shape) => shape.parentFrameId !== undefined && family.has(shape.parentFrameId))
        .map((shape) => shape.id);

    return { frames, shapes };
}

/** Deleting only the boundary releases its immediate children at their canvas positions. */
export function deleteFrame(
    document: Pick<Document, 'frames' | 'shapes' | 'selectedFrameId'>,
    id: string
) {
    delete document.frames[id];

    for (const child of [...Object.values(document.frames), ...Object.values(document.shapes)]) {
        if (child.parentFrameId === id) {
            delete child.parentFrameId;
        }
    }

    if (document.selectedFrameId === id) {
        delete document.selectedFrameId;
    }
}

/** A proposed parent may not lead into a cycle, including one made by this edit. */
export function validFrameParent(
    frames: Record<string, Frame>,
    id: string,
    parent: string | undefined
) {
    const seen = new Set([id]);
    let current = parent;

    while (current !== undefined) {
        if (!Object.hasOwn(frames, current) || seen.has(current)) {
            return false;
        }

        seen.add(current);
        current = frames[current].parentFrameId;
    }

    return true;
}

/** A container move must neither bypass a lock nor deform a group split by a merge. */
export function frameMoveProblem(document: Document, id: string) {
    const contents = frameContents(document, id);

    const lockedMembers = new Set(
        [
            ...Object.values(document.groups),
            ...Object.values(document.layers),
            ...Object.values(document.components)
        ]
            .filter((container) => container.locked)
            .flatMap((container) => container.shapesIds)
    );

    if (
        contents.frames.some((child) => document.frames[child].locked) ||
        contents.shapes.some((child) => document.shapes[child].locked || lockedMembers.has(child))
    ) {
        return 'Unlock all descendants to move this frame.';
    }

    const shapes = new Set(contents.shapes);
    if (
        Object.values(document.groups).some(
            (group) =>
                group.shapesIds.some((child) => shapes.has(child)) &&
                group.shapesIds.some((child) => !shapes.has(child))
        )
    ) {
        return 'Put all members of each group in the same frame before moving it.';
    }

    return undefined;
}
