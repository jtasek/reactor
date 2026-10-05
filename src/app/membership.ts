import type { Box, CommandScope, Document, Group, Layer, Point, Shape } from './types';
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

/**
 * The group whose box holds a point, if any: the last one, but never the group
 * double-clicked into, whose shapes are pressed one by one.
 */
export function groupAtPoint(
    document: Document,
    point: Point,
    enteredGroupId: string | null
): Group | undefined {
    return Object.values(document.groups).findLast((group) => {
        const frame = group.id === enteredGroupId ? undefined : document.groupFrames[group.id];

        if (!frame) {
            return false;
        }

        const { topLeft, bottomRight } = frame.box;
        const local = rotatePoint(point, boxCenter(frame.box), -frame.rotation);

        return (
            local.x >= topLeft.x &&
            local.x <= bottomRight.x &&
            local.y >= topLeft.y &&
            local.y <= bottomRight.y
        );
    });
}

/**
 * The groups to highlight under the pointer, as a press there would select
 * them: the pointer is over the canvas in their box, with no shape outside the
 * group under it and no drag in progress, and they are neither selected as one
 * nor the group double-clicked into.
 */
export function hoveredGroupsIds(
    document: Document,
    enteredGroupId: string | null,
    pointer: { current: Point; dragging: boolean; inside: boolean }
): string[] {
    const group =
        pointer.inside && !pointer.dragging
            ? groupAtPoint(document, pointer.current, enteredGroupId)
            : undefined;

    if (!group || selectedGroupsIdsOf(document, enteredGroupId).includes(group.id)) {
        return [];
    }

    const takesThePress = document.shapesIds.some(
        (id) => document.shapes[id].active && !group.shapesIds.includes(id)
    );

    return takesThePress ? [] : [group.id];
}

/** A shape, or a group as one, that a menu on the canvas acts on. */
export type CanvasItem = { kind: 'shape' | 'group'; id: string };

/**
 * The locked item under the pointer, whose menu the canvas shows while presses pass
 * through it: the group of the shape under the pointer, or of the box the pointer is
 * in, when that group is locked, or else the shape, when it is locked and in no group
 * a press would select. None when the item is selected,
 * as the selection's menu is then shown, off the canvas or during a drag.
 */
export function hoveredLockedItem(
    document: Document,
    enteredGroupId: string | null,
    pointer: { current: Point; dragging: boolean; inside: boolean }
): CanvasItem | null {
    if (!pointer.inside || pointer.dragging) {
        return null;
    }

    const shapeId = document.shapesIds.findLast((id) => document.shapes[id].active);
    const group =
        shapeId === undefined
            ? groupAtPoint(document, pointer.current, enteredGroupId)
            : shapeGroup(document, shapeId);

    // Locked, the group double-clicked into passes presses through its shapes too.
    if (group && (group.id !== enteredGroupId || group.locked)) {
        return group.locked && !selectedGroupsIdsOf(document, enteredGroupId).includes(group.id)
            ? { kind: 'group', id: group.id }
            : null;
    }

    const shape = shapeId === undefined ? undefined : document.shapes[shapeId];

    return shape?.locked && !shape.selected ? { kind: 'shape', id: shape.id } : null;
}

/**
 * The box a locked item is drawn in while it is still locked and not selected, for
 * its menu; none once it is gone, unlocked or selected.
 */
export function lockedItemExtent(
    document: Document,
    enteredGroupId: string | null,
    { kind, id }: CanvasItem
): Box | null {
    if (kind === 'shape') {
        const shape = document.shapes[id];

        return shape?.locked && !shape.selected ? drawnExtent(document, [id]) : null;
    }

    const group = document.groups[id];

    return group?.locked && !selectedGroupsIdsOf(document, enteredGroupId).includes(id)
        ? drawnExtent(document, shownGroupShapesIds(document, group))
        : null;
}

/** The layer every selected shape is on, when they are all on one. */
export function selectionLayerId(document: Document): string | undefined {
    const selected = document.selectedShapesIds;
    const [layer, another] = containersHolding(document.layers, selected);

    return layer && !another && selected.every((id) => layer.shapesIds.includes(id))
        ? layer.id
        : undefined;
}

/** The upright box around a shape as drawn, turned by its rotation. */
export function drawnBox(shape: Shape): Box {
    const bounds = getShapeBounds(shape);
    const rotation = shape.rotation ?? 0;

    if (rotation === 0) {
        return bounds;
    }

    const radians = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const width = bounds.width * cos + bounds.height * sin;
    const height = bounds.width * sin + bounds.height * cos;
    const center = boxCenter(bounds);
    const topLeft = { x: center.x - width / 2, y: center.y - height / 2 };

    return { topLeft, bottomRight: { x: topLeft.x + width, y: topLeft.y + height }, width, height };
}

/** The upright box around shapes as drawn, each turned by its rotation; none without shapes. */
export function drawnExtent(document: Document, shapeIds: string[]): Box | null {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const id of shapeIds) {
        const box = drawnBox(document.shapes[id]);

        left = Math.min(left, box.topLeft.x);
        top = Math.min(top, box.topLeft.y);
        right = Math.max(right, box.bottomRight.x);
        bottom = Math.max(bottom, box.bottomRight.y);
    }

    if (left === Infinity) {
        return null;
    }

    return {
        topLeft: { x: left, y: top },
        bottomRight: { x: right, y: bottom },
        width: right - left,
        height: bottom - top
    };
}

/**
 * The shapes shown, in drawing order, taken in one pass over the containers: as
 * `isShapeVisible` says of each, without searching the containers for each shape.
 */
export function shownShapesIds(document: Document): Set<string> {
    const shownLayer = document.shownLayerId ? document.layers[document.shownLayerId] : undefined;
    const onShownLayer = new Set(shownLayer?.shapesIds ?? []);
    const onLayers = new Set(Object.values(document.layers).flatMap((layer) => layer.shapesIds));
    const inHiddenContainer = new Set(
        [...Object.values(document.groups), ...Object.values(document.layers)]
            .filter((container) => !container.visible && container !== shownLayer)
            .flatMap((container) => container.shapesIds)
    );

    return new Set(
        document.shapesIds.filter(
            (id) =>
                document.shapes[id]?.visible &&
                !inHiddenContainer.has(id) &&
                !(shownLayer && onLayers.has(id) && !onShownLayer.has(id))
        )
    );
}

/** The upright box around the selected shapes as drawn; none without a selection. */
export const selectionExtent = (document: Document): Box | null =>
    drawnExtent(document, document.selectedShapesIds);

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
 * in drawing order, then the same for the shapes on no layer.
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
    const layersIds = Object.keys(document.layers);
    const unlayered = entry(null);
    // With layers, the entry stays when empty, as where a shape is dropped to leave its layer.
    const listed =
        layersIds.length > 0 || unlayered.groups.length > 0 || unlayered.shapesIds.length > 0;

    return [...layersIds.map(entry), ...(listed ? [unlayered] : [])];
}

/** The selected groups and the selected shapes outside them: what Hide and Lock act on. */
export function selectedItems(document: Document) {
    const groups = document.selectedGroupsIds.map((id) => document.groups[id]);
    const grouped = new Set(groups.flatMap((group) => group.shapesIds));
    const shapes = document.selectedShapesIds
        .filter((id) => !grouped.has(id))
        .map((id) => document.shapes[id]);

    return { groups, shapes };
}

/**
 * Whether something of the document is not shown: a shape, group or layer hidden
 * by its own setting, or the layers a highlighted layer leaves out.
 */
export const hasHidden = (document: Document) =>
    (document.shownLayerId !== undefined && document.layers[document.shownLayerId] !== undefined) ||
    [document.shapes, document.groups, document.layers].some((table) =>
        Object.values(table).some((item) => !item.visible)
    );

/**
 * Which items' commands the selection takes: one shape, one group selected as
 * one, or several items; none without a selection.
 */
export function selectionScope(document: Document): CommandScope | null {
    const { groups, shapes } = selectedItems(document);

    if (groups.length + shapes.length > 1) {
        return 'selection';
    }

    return groups.length === 1 ? 'group' : shapes.length === 1 ? 'shape' : null;
}

/**
 * The selected items alignment moves, as the shapes each moves: a group selected
 * as one with all its shapes, hidden ones too, and each other selected shape;
 * none with a locked shape.
 */
export function listMovableSelectedItems(document: Document): string[][] {
    const { groups, shapes } = selectedItems(document);
    const unlocked = (shapeIds: string[]) => !shapeIds.some((id) => isShapeLocked(document, id));

    return [...groups.map((group) => group.shapesIds), ...shapes.map((shape) => [shape.id])].filter(
        unlocked
    );
}
