import type {
    Action,
    ActionWithParam,
    Application,
    Group,
    Point,
    ResizeHandlerType
} from '../types';
import type { ShapesSnapshot } from 'src/events/types';
import { createGroup } from '../factories';
import { keepDrawnPlace, placeShapeFrom, resizeAspectBox } from '../geometry';
import {
    GROUP_MINIMUM,
    type GroupFrame,
    editableSelectedShapesIds,
    groupedShapesSelectedAlone,
    putShapesInGroup,
    putShapesOnLayer,
    removeFromContainers,
    shapeLayer
} from '../membership';
import {
    angleBetween,
    boxCenter,
    getShapeBounds,
    isShapeLocked,
    isShapeVisible,
    rotatePoint
} from '../utils';

const getGroup = ({ currentDocument }: Application, groupId: string) => {
    const group = currentDocument.groups[groupId];

    if (!group) {
        throw new Error(`Group ${groupId} not found`);
    }

    return group;
};

const setGroup = ({ currentDocument }: Application, group: Group) => {
    if (currentDocument) {
        currentDocument.groups[group.id] = group;
    }
};

const deleteGroup = ({ currentDocument }: Application, groupId: string) =>
    delete currentDocument.groups[groupId];

export const addGroup: ActionWithParam<Partial<Group>> = ({ state }, options) => {
    const group = createGroup(options);

    setGroup(state, group);
};

export const cloneGroup: ActionWithParam<string> = ({ state, effects }, groupId) => {
    const group = getGroup(state, groupId);

    setGroup(state, { ...group, id: effects.newId() });
};

export const removeGroup: ActionWithParam<string> = ({ state }, groupId) => {
    deleteGroup(state, groupId);
};

/**
 * Groups the selected shapes the commands may change, two at least, taking them
 * out of their groups first, as a shape is in one group at most.
 */
export const groupSelection: Action = ({ state }) => {
    const { currentDocument } = state;
    const shapesIds = editableSelectedShapesIds(currentDocument);

    if (shapesIds.length < GROUP_MINIMUM) {
        return;
    }

    removeFromContainers(currentDocument.groups, shapesIds, GROUP_MINIMUM);
    setGroup(state, createGroup({ shapesIds }));
    // A group is on one layer: the topmost shape's, or none.
    putShapesOnLayer(
        currentDocument,
        shapesIds,
        shapeLayer(currentDocument, shapesIds[shapesIds.length - 1])?.id ?? null
    );
};

/** Adds shapes that are not locked to an unlocked group, on its layer and out of any other group. */
export const addShapesToGroup: ActionWithParam<{ shapeIds: string[]; groupId: string }> = (
    { state },
    { shapeIds, groupId }
) => {
    const { currentDocument } = state;
    const group = currentDocument.groups[groupId];

    if (!group || group.locked) {
        return;
    }

    putShapesInGroup(
        currentDocument,
        shapeIds.filter((id) => !isShapeLocked(currentDocument, id)),
        groupId
    );
};

/** Removes the selected groups that are unlocked; their shapes stay selected. */
export const ungroupSelection: Action = ({ state }) => {
    const { currentDocument } = state;

    currentDocument.selectedGroupsIds
        .filter((id) => !currentDocument.groups[id].locked)
        .forEach((id) => deleteGroup(state, id));
};

/** Takes shapes selected alone out of their groups, removing a group left with one shape. */
export const removeSelectionFromGroups: Action = ({ state }) => {
    const { currentDocument } = state;

    removeFromContainers(
        currentDocument.groups,
        groupedShapesSelectedAlone(currentDocument),
        GROUP_MINIMUM
    );

    if (state.enteredGroupId && !currentDocument.groups[state.enteredGroupId]) {
        state.enteredGroupId = null;
    }
};

/** Selects a group's shown shapes, or unselects them when it is selected. */
export const toggleGroupSelected: ActionWithParam<string> = ({ state }, groupId) => {
    const { currentDocument } = state;
    const group = getGroup(state, groupId);
    const selected = !currentDocument.selectedGroupsIds.includes(groupId);

    if (state.enteredGroupId === groupId) {
        state.enteredGroupId = null;
    }

    group.shapesIds
        .filter((id) => isShapeVisible(currentDocument, id))
        .forEach((id) => {
            currentDocument.shapes[id].selected = selected;
        });
};

export const unselectGroup: ActionWithParam<string> = ({ state }, groupId) => {
    const group = getGroup(state, groupId);

    group.selected = false;
};

export const toggleGroupLocked: ActionWithParam<string> = ({ state }, groupId) => {
    const group = getGroup(state, groupId);

    group.locked = !group.locked;
};

export const lockGroup: ActionWithParam<string> = ({ state }, groupId) => {
    const group = getGroup(state, groupId);

    group.locked = true;
};

export const unlockGroup: ActionWithParam<string> = ({ state }, groupId) => {
    const group = getGroup(state, groupId);

    group.locked = false;
};

export const showGroup: ActionWithParam<string> = ({ state }, groupId) => {
    const group = getGroup(state, groupId);

    group.visible = true;
};

export const hideGroup: ActionWithParam<string> = ({ state }, groupId) => {
    const group = getGroup(state, groupId);

    group.visible = false;
};

export const toggleGroupVisible: ActionWithParam<string> = ({ state }, groupId) => {
    const group = getGroup(state, groupId);

    group.visible = !group.visible;
};

export const updateGroup: ActionWithParam<Partial<Group> & { id: string }> = (
    { state },
    options
) => {
    const group = getGroup(state, options.id);

    setGroup(state, { ...group, ...options });
};

/** A group's drag from its handle: the group's shapes and frame when the drag began. */
export interface GroupDrag {
    groupId: string;
    position: Point;
    shapes: ShapesSnapshot;
    frame: GroupFrame;
}

/**
 * Turns a group towards the pointer about its center: every shape turns about
 * the center by the same angle, and the group's box with them.
 */
export const rotateGroup: ActionWithParam<GroupDrag> = (
    { state },
    { groupId, position, shapes, frame }
) => {
    const { currentDocument } = state;
    const group = currentDocument.groups[groupId];

    if (!group) {
        return;
    }

    const center = boxCenter(frame.box);
    // The rotate handle sits directly above the box, so straight up is 0°.
    const rotation = angleBetween(center, position) + 90;
    const turn = rotation - frame.rotation;

    for (const [id, original] of Object.entries(shapes)) {
        const shape = currentDocument.shapes[id];

        if (!shape) {
            continue;
        }

        const from = boxCenter(getShapeBounds(original));
        const to = rotatePoint(from, center, turn);

        placeShapeFrom(shape, original, from, 1, { x: to.x - from.x, y: to.y - from.y });
        shape.rotation = (original.rotation ?? 0) + turn;
    }

    group.rotation = rotation;
};

/**
 * Scales a group from a handle so the handle follows the pointer: every shape
 * keeps its place in the group's box and is scaled by the same factor, so the
 * group keeps its look, and the opposite side stays where it is drawn.
 */
export const resizeGroup: ActionWithParam<GroupDrag & { handle: ResizeHandlerType }> = (
    { state },
    { groupId, handle, position, shapes, frame }
) => {
    const { currentDocument } = state;

    if (!currentDocument.groups[groupId]) {
        return;
    }

    const { box, rotation } = frame;
    const center = boxCenter(box);
    const local = rotation ? rotatePoint(position, center, -rotation) : position;
    const ratio = box.height > 0 ? box.width / box.height : 1;
    const resized = resizeAspectBox(box, handle, local, ratio);
    const placed = rotation ? keepDrawnPlace(resized, center, rotation) : resized;
    const factor = box.width > 0 ? placed.width / box.width : placed.height / box.height;
    const placedCenter = boxCenter(placed);

    for (const [id, original] of Object.entries(shapes)) {
        const shape = currentDocument.shapes[id];

        if (!shape) {
            continue;
        }

        const from = boxCenter(getShapeBounds(original));
        const inBox = rotation ? rotatePoint(from, center, -rotation) : from;
        const scaled = {
            x: placed.topLeft.x + (inBox.x - box.topLeft.x) * factor,
            y: placed.topLeft.y + (inBox.y - box.topLeft.y) * factor
        };
        const to = rotation ? rotatePoint(scaled, placedCenter, rotation) : scaled;

        placeShapeFrom(shape, original, from, factor, { x: to.x - from.x, y: to.y - from.y });
    }
};
