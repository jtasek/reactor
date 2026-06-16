import {
    Action,
    ActionGuard,
    ActionWithParam,
    Application,
    Box,
    Circle,
    Ellipse,
    Line,
    Pen,
    Point,
    ResizeHandlerType,
    Shape,
    Text
} from '../types';
import { Context } from '../index';
import { createShape } from '../factories';
import {
    DEFAULT_TEXT_FONT_SIZE,
    boxesEqual,
    getShapeBounds,
    mapPointBetweenBoxes,
    overlaps,
    isPointInBox,
    resizeBox
} from '../utils';

const getShape = ({ currentDocument }: Application, shapeId: string) => {
    const shape = currentDocument.shapes[shapeId];

    if (!shape) {
        throw new Error(`Shape ${shapeId} not found`);
    }

    return shape;
};

const setShape = ({ currentDocument }: Application, shape: Shape) => {
    if (currentDocument) {
        currentDocument.shapes[shape.id] = shape;
    }
};

const deleteShape = ({ currentDocument }: Application, shapeId: string) =>
    delete currentDocument.shapes[shapeId];

export const addShape: ActionWithParam<Partial<Shape>> = ({ state }, options) => {
    const shape = createShape(options);

    setShape(state, shape);
};

export const cloneShape: ActionWithParam<string> = ({ state, effects }, shapeId) => {
    const shape = getShape(state, shapeId);

    setShape(state, { ...shape, id: effects.newId() });
};

export const removeShape: ActionWithParam<string> = ({ state }, shapeId) => {
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

    const shapes = Object.values(state.currentDocument.shapes);
    shapes.forEach((shape) => {
        if (isPointInBox(current, shape)) {
            shape.selected = true;
        }
    });
};

/**
 * Resolves the shape under the pointer and updates the selection so a move can
 * begin, returning whether a shape was hit. Iterates shapesIds in z-order so the
 * topmost shape containing the point wins. Pressing an already-selected shape
 * keeps the whole selection intact (so a multi-selection can be dragged as a
 * group); pressing an unselected shape replaces the selection with just it; an
 * empty hit clears the selection.
 */
export const selectShapeAtPointer: ActionGuard = ({ state }) => {
    const { current } = state.events.pointer;
    const { shapesIds, shapes } = state.currentDocument;

    let hitId: string | null = null;
    for (const id of shapesIds) {
        const shape = shapes[id];
        if (shape && isPointInBox(current, shape)) {
            hitId = id;
        }
    }

    if (hitId === null) {
        shapesIds.forEach((id: string) => {
            const shape = shapes[id];
            if (shape && shape.selected) {
                shape.selected = false;
            }
        });

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

const translateShape = (shape: Shape, dx: number, dy: number) => {
    const line = shape as Line;
    if (line.start && line.end) {
        line.start = { x: line.start.x + dx, y: line.start.y + dy };
        line.end = { x: line.end.x + dx, y: line.end.y + dy };
    } else {
        const pen = shape as Pen;
        if (Array.isArray(pen.points)) {
            pen.points = pen.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
        } else if (shape.position) {
            shape.position = { x: shape.position.x + dx, y: shape.position.y + dy };
        }
    }

    // Shift the cached bounds too so the selection box and handles follow the
    // shape immediately, without waiting for the next getBBox measurement.
    if (shape.bounds) {
        shape.bounds = {
            topLeft: { x: shape.bounds.topLeft.x + dx, y: shape.bounds.topLeft.y + dy },
            bottomRight: { x: shape.bounds.bottomRight.x + dx, y: shape.bounds.bottomRight.y + dy },
            width: shape.bounds.width,
            height: shape.bounds.height
        };
    }
};

export const moveSelectedShapes: ActionWithParam<Point> = ({ state }, delta) => {
    const shapes = Object.values(state.currentDocument.shapes) as Shape[];
    shapes.forEach((shape) => {
        if (shape.selected) {
            translateShape(shape, delta.x, delta.y);
        }
    });
};

export const selectShapes: Action = ({ state }) => {
    const { topLeft, bottomRight } = state.events.pointer;
    const source = { topLeft, bottomRight };

    const shapes = Object.values(state.currentDocument.shapes) as Shape[];
    shapes.forEach((shape) => {
        const selected = overlaps(source, getShapeBounds(shape));

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
    const shapes = Object.values(state.currentDocument.shapes) as Shape[];
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

export const lockShape: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    shape.locked = true;
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

export const updateShape = ({ state }: Context, options: Partial<Shape> & { id: string }) => {
    const shape = getShape(state, options.id);

    setShape(state, { ...shape, ...options });
};

const centerOf = (box: Box): Point => ({
    x: box.topLeft.x + box.width / 2,
    y: box.topLeft.y + box.height / 2
});

/**
 * Resizes a box from a handle drag while locking it to `ratio` (width / height).
 * Corner handles keep the dominant axis and anchor the opposite corner; middle
 * handles drive their own axis, derive the other from the ratio, and stay
 * centred on the perpendicular axis.
 */
const resizeAspectBox = (
    oldBox: Box,
    handlerType: ResizeHandlerType,
    pointer: Point,
    ratio: number,
    min = 1
): Box => {
    const free = resizeBox(oldBox, handlerType, pointer, min);

    const left = oldBox.topLeft.x;
    const top = oldBox.topLeft.y;
    const right = oldBox.bottomRight.x;
    const bottom = oldBox.bottomRight.y;
    const centerX = left + oldBox.width / 2;
    const centerY = top + oldBox.height / 2;

    const isHorizontalMiddle = handlerType === 'middleLeft' || handlerType === 'middleRight';
    const isVerticalMiddle = handlerType === 'middleTop' || handlerType === 'middleBottom';

    let width = free.width;
    let height = free.height;

    if (isHorizontalMiddle) {
        height = width / ratio;
    } else if (isVerticalMiddle) {
        width = height * ratio;
    } else if (width / ratio >= height) {
        height = width / ratio;
    } else {
        width = height * ratio;
    }

    const movesLeft =
        handlerType === 'topLeft' || handlerType === 'middleLeft' || handlerType === 'bottomLeft';
    const movesRight =
        handlerType === 'topRight' ||
        handlerType === 'middleRight' ||
        handlerType === 'bottomRight';
    const movesTop =
        handlerType === 'topLeft' || handlerType === 'middleTop' || handlerType === 'topRight';
    const movesBottom =
        handlerType === 'bottomLeft' ||
        handlerType === 'middleBottom' ||
        handlerType === 'bottomRight';

    let x = centerX - width / 2;
    if (movesLeft) {
        x = right - width;
    } else if (movesRight) {
        x = left;
    }

    let y = centerY - height / 2;
    if (movesTop) {
        y = bottom - height;
    } else if (movesBottom) {
        y = top;
    }

    return {
        topLeft: { x, y },
        bottomRight: { x: x + width, y: y + height },
        width,
        height
    };
};

/** Maps a resized bounding box back onto a shape's native geometry. */
const applyBoxToShape = (
    shape: Shape,
    oldBox: Box,
    newBox: Box,
    handlerType: ResizeHandlerType,
    pointer: Point
) => {
    if (shape.type === 'image') {
        // Lock to the image's aspect ratio so it never letterboxes inside its
        // box (which would leave the selection border outside the picture).
        const ratio = oldBox.height > 0 ? oldBox.width / oldBox.height : 1;
        const box = resizeAspectBox(oldBox, handlerType, pointer, ratio);

        shape.position = { x: box.topLeft.x, y: box.topLeft.y };
        shape.size = { width: box.width, height: box.height };
        return;
    }

    if (shape.size) {
        // rectangle
        shape.position = { x: newBox.topLeft.x, y: newBox.topLeft.y };
        shape.size = { width: newBox.width, height: newBox.height };
        return;
    }

    if (shape.type === 'circle') {
        const box = resizeAspectBox(oldBox, handlerType, pointer, 1);
        shape.position = centerOf(box);
        (shape as Circle).radius = box.width / 2;
        return;
    }

    if (shape.type === 'ellipse') {
        const center = centerOf(newBox);
        shape.position = center;
        (shape as Ellipse).radius = { x: newBox.width / 2, y: newBox.height / 2 };
        return;
    }

    const line = shape as Line;
    if (line.start && line.end) {
        line.start = mapPointBetweenBoxes(line.start, oldBox, newBox);
        line.end = mapPointBetweenBoxes(line.end, oldBox, newBox);
        return;
    }

    const pen = shape as Pen;
    if (Array.isArray(pen.points)) {
        pen.points = pen.points.map((point) => mapPointBetweenBoxes(point, oldBox, newBox));
        return;
    }

    if (shape.type === 'text') {
        const text = shape as Text;
        const ratio = oldBox.height > 0 ? newBox.height / oldBox.height : 1;

        text.fontSize = Math.max(1, (text.fontSize ?? DEFAULT_TEXT_FONT_SIZE) * ratio);
        // Keep the top-left edge following the handle (text anchors at its baseline).
        shape.position = {
            x: newBox.topLeft.x,
            y: (shape.position?.y ?? newBox.topLeft.y) + (newBox.topLeft.y - oldBox.topLeft.y)
        };
    }
};

export const resizeShape = (
    { state }: Context,
    payload: {
        shapeId: string;
        handlerType: ResizeHandlerType;
        position: Point;
    }
) => {
    const { shapeId, handlerType, position } = payload;

    const shape = state.currentDocument?.shapes[shapeId];

    if (!shape) {
        return;
    }

    const oldBox = getShapeBounds(shape);
    const newBox = resizeBox(oldBox, handlerType, position);

    applyBoxToShape(shape, oldBox, newBox, handlerType, position);
};
