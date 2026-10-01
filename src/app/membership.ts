import type { Box, Document, Group, Layer, Point } from './types';
import { boxCenter, getShapeBounds, isShapeLocked, isShapeVisible, rotatePoint } from './utils';

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

/**
 * `shapeIds` with every other shape of their groups, as a group is selected as
 * one, except the group double-clicked into, whose shapes are selected alone.
 */
export function withTheirGroups(
    document: Document,
    shapeIds: Iterable<string>,
    enteredGroupId: string | null
): Set<string> {
    const ids = new Set(shapeIds);

    containersHolding(document.groups, ids)
        .filter((group) => group.id !== enteredGroupId)
        .forEach((group) => group.shapesIds.forEach((id) => ids.add(id)));

    return ids;
}

/** The group holding a shape, if any. */
export function shapeGroup(document: Document, shapeId: string): Group | undefined {
    return containersHolding(document.groups, [shapeId])[0];
}

/** A group's shapes that are shown. */
export function shownGroupShapesIds(document: Document, group: Group): string[] {
    return group.shapesIds.filter((id) => isShapeVisible(document, id));
}

/** Where a group is drawn: an upright box around its center, turned by `rotation`. */
export interface GroupFrame {
    box: Box;
    rotation: number;
}

/**
 * The box around a group's shown shapes as drawn, each turned by its own
 * rotation, in the group's turned frame; none when no shape is shown.
 */
export function groupFrame(document: Document, group: Group): GroupFrame | null {
    const rotation = group.rotation ?? 0;
    const origin = { x: 0, y: 0 };
    const corners = shownGroupShapesIds(document, group).flatMap((id) => {
        const shape = document.shapes[id];
        const bounds = getShapeBounds(shape);
        const center = boxCenter(bounds);
        const { topLeft, bottomRight } = bounds;

        return [
            topLeft,
            { x: bottomRight.x, y: topLeft.y },
            bottomRight,
            { x: topLeft.x, y: bottomRight.y }
        ].map((corner) =>
            rotatePoint(rotatePoint(corner, center, shape.rotation ?? 0), origin, -rotation)
        );
    });

    if (corners.length === 0) {
        return null;
    }

    const xs = corners.map((corner: Point) => corner.x);
    const ys = corners.map((corner: Point) => corner.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    const center = rotatePoint(
        { x: Math.min(...xs) + width / 2, y: Math.min(...ys) + height / 2 },
        origin,
        rotation
    );
    const topLeft = { x: center.x - width / 2, y: center.y - height / 2 };

    return {
        box: {
            topLeft,
            bottomRight: { x: topLeft.x + width, y: topLeft.y + height },
            width,
            height
        },
        rotation
    };
}

/**
 * The groups selected as one: every shown shape of theirs is selected, and they
 * are not the group double-clicked into.
 */
export function selectedGroupsIdsOf(document: Document, enteredGroupId: string | null): string[] {
    return Object.values(document.groups)
        .filter((group) => {
            const shown = shownGroupShapesIds(document, group);

            return (
                group.id !== enteredGroupId &&
                shown.length > 0 &&
                shown.every((id) => document.shapes[id].selected)
            );
        })
        .map((group) => group.id);
}

/** The selected shapes the commands may change, in drawing order. */
export function editableSelectedShapesIds(document: Document): string[] {
    const selected = new Set(document.selectedShapesIds);

    return document.shapesIds.filter((id) => selected.has(id) && !isShapeLocked(document, id));
}

/**
 * The selected shapes the commands may change that are in an unlocked group not
 * selected as one, as inside the group double-clicked into.
 */
export function groupedShapesSelectedAlone(document: Document): string[] {
    const wholeGroups = new Set(
        document.selectedGroupsIds.flatMap((id) => document.groups[id].shapesIds)
    );
    const grouped = new Set(
        Object.values(document.groups)
            .filter((group) => !group.locked)
            .flatMap((group) => group.shapesIds)
    );

    return editableSelectedShapesIds(document).filter(
        (id) => grouped.has(id) && !wholeGroups.has(id)
    );
}

/** The layer a shape is on, if any. */
export function shapeLayer(document: Document, shapeId: string): Layer | undefined {
    return containersHolding(document.layers, [shapeId])[0];
}

/**
 * Puts shapes on a layer, or on none, out of any other, removing layers left
 * empty. A group is on one layer: a group moved whole stays a group, and a shape
 * moved without the rest of its group leaves it.
 */
export function putShapesOnLayer(
    document: Document,
    shapeIds: Iterable<string>,
    layerId: string | null
) {
    const ids = new Set(shapeIds);
    const leavingGroups = containersHolding(document.groups, ids)
        .filter((group) => !group.shapesIds.every((id) => ids.has(id)))
        .flatMap((group) => group.shapesIds.filter((id) => ids.has(id)));

    removeFromContainers(document.groups, leavingGroups, GROUP_MINIMUM);

    for (const layer of Object.values(document.layers)) {
        if (layer.id === layerId) {
            const held = new Set(layer.shapesIds);

            layer.shapesIds = [...layer.shapesIds, ...[...ids].filter((id) => !held.has(id))];
        } else if (layer.shapesIds.some((id) => ids.has(id))) {
            layer.shapesIds = layer.shapesIds.filter((id) => !ids.has(id));

            if (layer.shapesIds.length < LAYER_MINIMUM) {
                delete document.layers[layer.id];
            }
        }
    }
}

/**
 * Adds shapes to a group, out of any other group, and puts them on the group's
 * layer, the one its first shape is on.
 */
export function putShapesInGroup(document: Document, shapeIds: string[], groupId: string) {
    const group = document.groups[groupId];
    const added = shapeIds.filter((id) => !group.shapesIds.includes(id));

    putShapesOnLayer(document, added, shapeLayer(document, group.shapesIds[0])?.id ?? null);

    for (const other of containersHolding(document.groups, added)) {
        other.shapesIds = other.shapesIds.filter((id) => !added.includes(id));

        if (other.shapesIds.length < GROUP_MINIMUM) {
            delete document.groups[other.id];
        }
    }

    group.shapesIds = [...group.shapesIds, ...added];
}

/** A layer of the outline, or the shapes on no layer: its groups, then its other shapes. */
export interface OutlineLayer {
    layerId: string | null;
    groups: { groupId: string; shapesIds: string[] }[];
    shapesIds: string[];
}

/**
 * The document as a tree: each layer with its groups and its shapes in no group,
 * in drawing order, then the same for the shapes on no layer when there are any.
 * A group is listed under the layer of its first shape.
 */
export function outline(document: Document): OutlineLayer[] {
    const layerOf = new Map<string, string>();
    const groupOf = new Map<string, string>();

    Object.values(document.layers).forEach((layer) =>
        layer.shapesIds.forEach((id) => layerOf.set(id, layer.id))
    );
    Object.values(document.groups).forEach((group) =>
        group.shapesIds.forEach((id) => groupOf.set(id, group.id))
    );

    const entry = (layerId: string | null): OutlineLayer => ({
        layerId,
        groups: Object.values(document.groups)
            .filter(
                (group) =>
                    group.shapesIds.length > 0 &&
                    (layerOf.get(group.shapesIds[0]) ?? null) === layerId
            )
            .map((group) => ({ groupId: group.id, shapesIds: [...group.shapesIds] })),
        shapesIds: document.shapesIds.filter(
            (id) => !groupOf.has(id) && (layerOf.get(id) ?? null) === layerId
        )
    });
    const unlayered = entry(null);

    return [
        ...Object.keys(document.layers).map(entry),
        ...(unlayered.groups.length > 0 || unlayered.shapesIds.length > 0 ? [unlayered] : [])
    ];
}
