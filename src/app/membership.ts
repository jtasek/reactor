import type { Document, Group, Layer } from './types';
import { isShapeLocked } from './utils';

/** A group has two shapes at least; one left alone is no longer grouped. */
export const GROUP_MINIMUM = 2;

/** A layer has a shape at least; an empty one is removed. */
export const LAYER_MINIMUM = 1;

/** The containers in `table` holding any of `shapeIds`. */
export function containersHolding<T extends Group | Layer>(
    table: Record<string, T>,
    shapeIds: Iterable<string>
): T[] {
    const ids = new Set(shapeIds);

    return Object.values(table).filter((container) =>
        container.shapesIds.some((id) => ids.has(id))
    );
}

/**
 * Takes `shapeIds` out of every container in `table`, removing the containers
 * left with fewer than `minimum` shapes.
 */
export function removeFromContainers(
    table: Record<string, Group | Layer>,
    shapeIds: Iterable<string>,
    minimum: number
) {
    const ids = new Set(shapeIds);

    for (const container of containersHolding(table, ids)) {
        container.shapesIds = container.shapesIds.filter((id) => !ids.has(id));

        if (container.shapesIds.length < minimum) {
            delete table[container.id];
        }
    }
}

/** `shapeIds` with every other shape of their groups, as a group is selected as one. */
export function withTheirGroups(document: Document, shapeIds: Iterable<string>): Set<string> {
    const ids = new Set(shapeIds);

    containersHolding(document.groups, ids).forEach((group) =>
        group.shapesIds.forEach((id) => ids.add(id))
    );

    return ids;
}

/** The selected shapes the commands may change, in drawing order. */
export function editableSelectedShapesIds(document: Document): string[] {
    const selected = new Set(document.selectedShapesIds);

    return document.shapesIds.filter((id) => selected.has(id) && !isShapeLocked(document, id));
}
