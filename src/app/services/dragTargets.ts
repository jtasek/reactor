import type { SnapTargets } from '../snapping';

/**
 * The lines the drag in progress snaps to, kept out of the store: there are
 * three for each shape on each axis, and nothing shows them.
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
