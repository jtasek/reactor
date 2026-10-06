import type { SnapTargets } from '../snapping';

/**
 * The lines the drag in progress snaps to, and the shapes' points along them, kept
 * out of the store: there are three lines for each shape on each axis, set once as
 * the drag begins, so nothing needs to follow their changes. `SnapLines` reads them
 * while the drag lasts to mark the points lined up.
 */
export function createDragTargets() {
    let current: SnapTargets | null = null;

    return {
        take(targets: SnapTargets) {
            current = targets;
        },
        current: () => current,
        clear() {
            current = null;
        }
    };
}

export const dragTargets = createDragTargets();
