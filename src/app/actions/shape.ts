import {
    Action,
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
    const shapes = Object.values(state.currentDocument.shapes);
    shapes.forEach((shape) => (shape.selected = false));
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

/** Computes a circle's new center+radius from a handle drag, anchoring the opposite side. */
const resizeCircle = (oldBox: Box, handlerType: ResizeHandlerType, pointer: Point, min = 1) => {
    const left = oldBox.topLeft.x;
    const top = oldBox.topLeft.y;
    const right = oldBox.bottomRight.x;
    const bottom = oldBox.bottomRight.y;

    let diameter = oldBox.width;
    let cx = left + oldBox.width / 2;
    let cy = top + oldBox.height / 2;

    switch (handlerType) {
        case 'middleRight':
            diameter = Math.max(pointer.x - left, min);
            cx = left + diameter / 2;
            break;
        case 'middleLeft':
            diameter = Math.max(right - pointer.x, min);
            cx = right - diameter / 2;
            break;
        case 'middleBottom':
            diameter = Math.max(pointer.y - top, min);
            cy = top + diameter / 2;
            break;
        case 'middleTop':
            diameter = Math.max(bottom - pointer.y, min);
            cy = bottom - diameter / 2;
            break;
        case 'bottomRight':
            diameter = Math.max(pointer.x - left, pointer.y - top, min);
            cx = left + diameter / 2;
            cy = top + diameter / 2;
            break;
        case 'topLeft':
            diameter = Math.max(right - pointer.x, bottom - pointer.y, min);
            cx = right - diameter / 2;
            cy = bottom - diameter / 2;
            break;
        case 'topRight':
            diameter = Math.max(pointer.x - left, bottom - pointer.y, min);
            cx = left + diameter / 2;
            cy = bottom - diameter / 2;
            break;
        case 'bottomLeft':
            diameter = Math.max(right - pointer.x, pointer.y - top, min);
            cx = right - diameter / 2;
            cy = top + diameter / 2;
            break;
    }

    return { center: { x: cx, y: cy }, radius: diameter / 2 };
};

/** Maps a resized bounding box back onto a shape's native geometry. */
const applyBoxToShape = (
    shape: Shape,
    oldBox: Box,
    newBox: Box,
    handlerType: ResizeHandlerType,
    pointer: Point
) => {
    if (shape.size) {
        // rectangle / image
        shape.position = { x: newBox.topLeft.x, y: newBox.topLeft.y };
        shape.size = { width: newBox.width, height: newBox.height };
        return;
    }

    if (shape.type === 'circle') {
        const { center, radius } = resizeCircle(oldBox, handlerType, pointer);
        shape.position = center;
        (shape as Circle).radius = radius;
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
