import type { Document, Frame } from './types';
import { frameParents } from './frameState';

/** The shared screen that owns an entity's authored geometry, if any. */
export function screenOwners(frames: Record<string, Frame>) {
    const parents = frameParents(frames);
    const owners = new Map<string, string | undefined>();

    for (const id of Object.keys(frames)) {
        const path: string[] = [];
        let current: string | undefined = id;

        while (current !== undefined && !owners.has(current)) {
            path.push(current);

            if (frames[current]?.kind === 'screen') {
                owners.set(current, current);
                break;
            }

            current = parents.get(current);
        }

        const owner = current === undefined ? undefined : owners.get(current);
        path.forEach((member) => owners.set(member, owner));
    }

    return owners;
}

export function screenSourceShapes(document: Pick<Document, 'frames' | 'shapes'>) {
    const owners = screenOwners(document.frames);

    return new Set(
        Object.values(document.shapes)
            .filter(
                (shape) =>
                    owners.has(shape.parentFrameId ?? '') &&
                    owners.get(shape.parentFrameId ?? '') !== undefined
            )
            .map((shape) => shape.id)
    );
}

export function screenViewName(document: Pick<Document, 'frames'>, view: Frame | undefined) {
    if (!view) {
        return '';
    }

    if (view.kind !== 'view') {
        return view.name;
    }

    const screen = document.frames[view.screenId ?? ''];

    return `${screen?.name ?? 'Missing screen'} · ${view.name}`;
}
