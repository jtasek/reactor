import {
    Action,
    ActionGuard,
    ActionWithParam,
    Application,
    Box,
    Point,
    ResizeHandlerType,
    Shape,
    ShapeInput
} from '../types';
import { Context } from '../index';
import { createShape } from '../factories';
import { orderAbove, ordersAbove, ordersBelow } from '../drawOrder';
import { PropertyValue, SHAPE_PROPERTIES, applyProperty, canEdit } from '../properties';
import { readClipboard, writeClipboard } from '../clipboard';
import {
    hitTestShape,
    hitTolerance,
    resizeShapeFromHandle,
    shapeIntersectsBox,
    translateShape
} from '../geometry';
import {
    boxesEqual,
    getShapeBounds,
    isShapeLocked,
    isShapeVisible,
    shapeGeometry,
    shapeGeometryKey,
    boxCenter,
    angleBetween
} from '../utils';

const getShape = ({ currentDocument }: Application, shapeId: string) => {
    const shape = currentDocument.shapes[shapeId];

    if (!shape) {
        throw new Error(`Shape ${shapeId} not found`);
    }

    return shape;
};

/** Adds a new shape whose order is above every other shape's. */
const putOnTop = ({ currentDocument }: Application, shape: Shape) => {
    currentDocument.shapes[shape.id] = shape;
    currentDocument.shapesIds.push(shape.id);
};

const topOrder = ({ currentDocument }: Application) => {
    const { shapes, shapesIds } = currentDocument;
    const top = shapesIds[shapesIds.length - 1];

    return top ? shapes[top].order : null;
};

/** Shapes the pointer can hit, select and drag: visible and not locked. */
const isInteractive = ({ currentDocument }: Application, shapeId: string) =>
    isShapeVisible(currentDocument, shapeId) && !isShapeLocked(currentDocument, shapeId);

const deleteShape = ({ currentDocument }: Application, shapeId: string) => {
    const index = currentDocument.shapesIds.indexOf(shapeId);

    if (index >= 0) {
        currentDocument.shapesIds.splice(index, 1);
    }

    delete currentDocument.shapes[shapeId];

    for (const table of [
        currentDocument.groups,
        currentDocument.layers,
        currentDocument.components
    ]) {
        for (const member of Object.values(table)) {
            member.shapesIds = member.shapesIds.filter((id) => id !== shapeId);
        }
    }

    for (const link of Object.values(currentDocument.links)) {
        if (link.source === shapeId || link.target === shapeId) {
            delete currentDocument.links[link.id];
        }
    }

    for (const shape of Object.values(currentDocument.shapes)) {
        if (shape.parentShapeId === shapeId) {
            delete shape.parentShapeId;
        }

        if (shape.children) {
            shape.children = shape.children.filter((child) => child.id !== shapeId);
        }
    }
};

export const addShape: ActionWithParam<ShapeInput> = ({ state }, options) => {
    const shape = createShape({ ...options, order: orderAbove(topOrder(state)) });

    putOnTop(state, shape);
};

/** How far a clone is offset from its original so it does not cover it. */
const CLONE_OFFSET: Point = { x: 10, y: 10 };

/**
 * Adds an independent copy of each shape, offset by `CLONE_OFFSET`, above all
 * other shapes and stacked like the originals. A copy keeps its original's
 * geometry and appearance but gets its own id, name and timestamps, starts
 * unselected and is measured afresh.
 */
export const cloneShapes: ActionWithParam<string[]> = ({ state }, shapeIds) => {
    const { shapes, shapesIds } = state.currentDocument;
    const cloning = new Set(shapeIds);
    let order = topOrder(state);

    for (const id of shapesIds.filter((shapeId) => cloning.has(shapeId))) {
        const original = shapes[id];

        order = orderAbove(order);

        const clone = createShape({
            ...shapeGeometry(original),
            order,
            name: `Clone of ${original.name}`,
            description: original.description,
            parentShapeId: original.parentShapeId,
            rotation: original.rotation,
            locked: original.locked,
            visible: original.visible,
            selected: false
        });

        translateShape(clone, CLONE_OFFSET);
        putOnTop(state, clone);
    }
};

/** The clipboard holds shapes only in the designer, and not while typing or dragging. */
const usesClipboard = ({ currentPage, events }: Context['state']) =>
    currentPage === 'designer' && !events.keyboard.typing && !events.pointer.dragging;

const selectedInDrawOrder = ({ currentDocument }: Application) =>
    currentDocument.shapesIds
        .map((id) => currentDocument.shapes[id])
        .filter((shape) => shape.selected);

/** The selected shapes as clipboard text, or null when there are none to copy. */
export const copySelection = ({ state }: Context): string | null => {
    const selected = usesClipboard(state) ? selectedInDrawOrder(state) : [];

    return selected.length > 0 ? writeClipboard(selected) : null;
};

/**
 * Removes the selected shapes that are not locked and returns them as clipboard
 * text, or null when there are none to cut.
 */
export const cutSelection = ({ state }: Context): string | null => {
    const cut = usesClipboard(state)
        ? selectedInDrawOrder(state).filter(
              (shape) => !isShapeLocked(state.currentDocument, shape.id)
          )
        : [];

    if (cut.length === 0) {
        return null;
    }

    const text = writeClipboard(cut);

    cut.forEach((shape) => deleteShape(state, shape.id));

    return text;
};

/**
 * Adds the shapes clipboard text holds above all others, selected in place of the
 * selection. Where the first already has a shape drawn exactly like it, as when
 * pasting into the document copied from, they are offset like clones until it has
 * not. Returns whether the text held shapes.
 */
export const pasteShapes = ({ state, actions }: Context, text: string): boolean => {
    const copied = usesClipboard(state) ? readClipboard(text) : [];

    if (copied.length === 0) {
        return false;
    }

    const drawn = new Set(Object.values(state.currentDocument.shapes).map(shapeGeometryKey));
    let order = topOrder(state);
    const pasted = copied.map((input) => {
        order = orderAbove(order);

        return createShape({ ...input, order, selected: true });
    });

    while (drawn.has(shapeGeometryKey(pasted[0]))) {
        pasted.forEach((shape) => translateShape(shape, CLONE_OFFSET));
    }

    actions.unselectShapes();
    pasted.forEach((shape) => putOnTop(state, shape));

    return true;
};

/**
 * Moves unlocked shapes to the top or the bottom of the draw order, keeping their
 * order among themselves.
 */
const moveToEdge = (
    { currentDocument }: Application,
    shapeIds: string[],
    edge: 'front' | 'back'
) => {
    const { shapes, shapesIds } = currentDocument;
    const moving = new Set(shapeIds.filter((id) => !isShapeLocked(currentDocument, id)));
    const moved = shapesIds.filter((id) => moving.has(id));
    const rest = shapesIds.filter((id) => !moving.has(id));

    if (moved.length === 0) {
        return;
    }

    const orders =
        edge === 'front'
            ? ordersAbove(shapes[shapesIds[shapesIds.length - 1]].order, moved.length)
            : ordersBelow(shapes[shapesIds[0]].order, moved.length);

    moved.forEach((id, index) => {
        shapes[id].order = orders[index];
    });
    currentDocument.shapesIds = edge === 'front' ? [...rest, ...moved] : [...moved, ...rest];
};

export const bringShapesToFront: ActionWithParam<string[]> = ({ state }, shapeIds) => {
    moveToEdge(state, shapeIds, 'front');
};

export const sendShapesToBack: ActionWithParam<string[]> = ({ state }, shapeIds) => {
    moveToEdge(state, shapeIds, 'back');
};

export const removeShape: ActionWithParam<string> = ({ state }, shapeId) => {
    if (isShapeLocked(state.currentDocument, shapeId)) {
        return;
    }

    deleteShape(state, shapeId);
};

export const toggleShapeSelected: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    shape.selected = !shape.selected;
};

export const selectShape: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    shape.selected = true;
};

export const selectShapeByPoint: Action = ({ state }) => {
    const { current } = state.events.pointer;
    const tolerance = hitTolerance(state.currentDocument.camera.scale);

    const shapes = Object.values(state.currentDocument.shapes);
    shapes.forEach((shape) => {
        if (hitTestShape(shape, current, tolerance) && isInteractive(state, shape.id)) {
            shape.selected = true;
        }
    });
};

/**
 * Resolves the shape under the pointer and updates the selection so a move can
 * begin, returning whether a shape was hit. Iterates shapesIds in z-order so the
 * topmost shape drawn under the point (see hitTestShape) wins. Pressing an
 * already-selected shape keeps the whole selection intact (so a multi-selection
 * can be dragged as a group); pressing an unselected shape replaces the
 * selection with just it. An empty hit leaves the selection untouched — the
 * caller decides what an empty-canvas press means (pan, marquee or deselect).
 */
export const selectShapeAtPointer: ActionGuard = ({ state }) => {
    const { current } = state.events.pointer;
    const { shapesIds, shapes, camera } = state.currentDocument;
    const tolerance = hitTolerance(camera.scale);

    let hitId: string | null = null;
    for (const id of shapesIds) {
        const shape = shapes[id];

        if (shape && hitTestShape(shape, current, tolerance) && isInteractive(state, id)) {
            hitId = id;
        }
    }

    if (hitId === null) {
        return false;
    }

    // Preserve an existing multi-selection when grabbing one of its members, so
    // the whole group moves together.
    if (shapes[hitId]?.selected) {
        return true;
    }

    shapesIds.forEach((id: string) => {
        const shape = shapes[id];

        if (!shape) {
            return;
        }

        const selected = id === hitId;

        if (shape.selected !== selected) {
            shape.selected = selected;
        }
    });

    return true;
};

export const moveSelectedShapes: ActionWithParam<Point> = ({ state }, delta) => {
    const shapes = Object.values(state.currentDocument.shapes);
    shapes.forEach((shape) => {
        if (shape.selected && isInteractive(state, shape.id)) {
            translateShape(shape, delta);
        }
    });
};

export const selectShapes: Action = ({ state }) => {
    const { topLeft, bottomRight, size } = state.events.pointer;
    const source = { topLeft, bottomRight };
    // A click without a drag clears the selection: presses select by hit-testing,
    // so a click that missed must not select a bounding box containing it.
    const isClick = size.width === 0 && size.height === 0;

    const shapes = Object.values(state.currentDocument.shapes);
    shapes.forEach((shape) => {
        const selected =
            !isClick && isInteractive(state, shape.id) && shapeIntersectsBox(shape, source);

        // Only write when the value actually changes so shapes that stay
        // outside (or inside) the marquee don't re-render every pointer move.
        if (shape.selected !== selected) {
            shape.selected = selected;
        }
    });
};

export const setShapeBounds: ActionWithParam<{ id: string; bounds: Box }> = (
    { state },
    { id, bounds }
) => {
    const shape = state.currentDocument.shapes[id];

    if (!shape) {
        return;
    }

    // Idempotent: skip the write when the measured box is unchanged so the
    // measurement effect cannot trigger a render loop.
    if (shape.bounds && boxesEqual(shape.bounds, bounds)) {
        return;
    }

    shape.bounds = bounds;
};

export const unselectShapes: Action = ({ state }) => {
    const shapes = Object.values(state.currentDocument.shapes);
    shapes.forEach((shape) => {
        // Only write when it actually changes, so a background click with nothing
        // selected doesn't needlessly re-render every shape.
        if (shape.selected) {
            shape.selected = false;
        }
    });
};

export const unselectShape: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    shape.selected = false;
};

export const activateShape: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    if (!shape.active) {
        shape.active = true;
    }
};

export const deactivateShape: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    if (shape.active) {
        shape.active = false;
    }
};

export const lockShape: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    shape.locked = true;
};

export const toggleShapeLocked: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    shape.locked = !shape.locked;
};

export const toggleShapeVisible: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    shape.visible = !shape.visible;
};

export const unlockShape: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    shape.locked = false;
};

export const showShape: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    shape.visible = true;
};

export const hideShape = ({ state }: Context, shapeId: string) => {
    const shape = getShape(state, shapeId);

    shape.visible = false;
};

export const updateShape = ({ state }: Context, options: Partial<ShapeInput> & { id: string }) => {
    if (isShapeLocked(state.currentDocument, options.id)) {
        return;
    }

    const shape = getShape(state, options.id);

    // A shape's type fixes which geometry it has, so an update cannot change it.
    if (options.type !== undefined && options.type !== shape.type) {
        return;
    }

    Object.assign(shape, options);
};

/**
 * Sets a property-panel property (see SHAPE_PROPERTIES) on each shape where it
 * can change now (see canEdit): locked shapes only take metadata such as their
 * name, and nothing changes in a locked document.
 */
export const setShapesProperty = (
    { state }: Context,
    { shapeIds, key, value }: { shapeIds: string[]; key: string; value: PropertyValue }
) => {
    const property = SHAPE_PROPERTIES.find((item) => item.key === key);

    if (!property) {
        return;
    }

    shapeIds.forEach((id) => {
        const shape = state.currentDocument.shapes[id];

        if (!shape || !canEdit(property, shape, state.currentDocument)) {
            return;
        }

        applyProperty(property, shape, value);
    });
};

export const resizeShape = (
    { state }: Context,
    payload: {
        shapeId: string;
        handlerType: ResizeHandlerType;
        position: Point;
        /** The shape as it was when the drag began; the shape itself when there is none. */
        original?: Shape;
    }
) => {
    const { shapeId, handlerType, position, original } = payload;

    const shape = state.currentDocument?.shapes[shapeId];

    if (!shape || !isInteractive(state, shapeId)) {
        return;
    }

    resizeShapeFromHandle(shape, handlerType, position, original ?? shape);
};

export const rotateShape = (
    { state }: Context,
    payload: {
        shapeId: string;
        position: Point;
    }
) => {
    const { shapeId, position } = payload;

    const shape = state.currentDocument?.shapes[shapeId];

    if (!shape || !isInteractive(state, shapeId)) {
        return;
    }

    const center = boxCenter(getShapeBounds(shape));

    // The rotate handle sits directly above the shape, so a pointer straight up
    // from the center maps to 0°. atan2 measures from the +x axis, hence +90.
    shape.rotation = angleBetween(center, position) + 90;
};
