import type { Pointer } from 'src/events/types';
import { Action, ActionWithParam, Application, Circle, Point, Shape } from '../types';
import { Context } from '../index';
import { createShape } from '../factories';
import { getBoundingBox, overlaps, isPointInBox } from '../utils';

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

    const shapes = Object.values(state.currentDocument.shapes);
    shapes.forEach((shape) => {
        if (overlaps(source, getBoundingBox(shape))) {
            shape.selected = true;
        }
    });
};

export const unselectShapes: Action = ({ state }) => {
    const shapes = Object.values(state.currentDocument.shapes);
    console.log('unselectShapes()');
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

export const resizeShape = (
    { state }: Context,
    payload: {
        shapeId: string;
        handlerType: string;
        position: Point;
    }
) => {
    const { shapeId, handlerType, position } = payload;

    const shape = getShape(state, shapeId);
    const diffx = position.x - shape.position.x;
    const diffy = position.y - shape.position.y;

    if (shape.type === 'circle') {
        const radiusChange = Math.sqrt(Math.pow(diffx, 2) + Math.pow(diffy, 2));
        (shape as Circle).radius = radiusChange;
        return;
    }

    const topLeft = shape.position;
    const bottomRight = { x: topLeft!.x + shape.size!.width, y: topLeft!.y + shape.size!.height };

    switch (handlerType) {
        case 'topLeft':
            if (position.y < bottomRight.y) {
                shape.position!.y = position.y;
                shape.size!.height -= diffy;
            }
            if (position.x < bottomRight.x) {
                shape.position!.x = position.x;
                shape.size!.width = shape.size!.width - diffx;
            }
            break;
        case 'middleTop':
            if (position.y < bottomRight.y) {
                shape.position!.y = position.y;
                shape.size!.height -= diffy;
            }
            break;
        case 'topRight':
            if (position.x > topLeft!.x) {
                shape.size!.width = diffx;
            }
            if (position.y < bottomRight!.y) {
                shape.position!.y = position.y;
                shape.size!.height -= diffy;
            }
            break;
        case 'middleRight':
            if (position.x > shape.position!.x) {
                shape.size!.width = diffx;
            }
            break;
        case 'bottomRight':
            if (position.x > shape.position!.x) {
                shape.size!.width = diffx;
            }
            if (position.y > shape.position!.y) {
                shape.size!.height = diffy;
            }
            break;
        case 'middleBottom':
            if (position.y > shape.position!.y) {
                shape.size!.height = diffy;
            }
            break;
        case 'bottomLeft':
            if (position.x < bottomRight!.x) {
                shape.position!.x = position.x;
                shape.size!.width = shape.size!.width - diffx;
            }
            if (position.y > topLeft!.y) {
                shape.size!.height = diffy;
            }
            break;
        case 'middleLeft':
            if (position.x < bottomRight!.x) {
                shape.position!.x = position.x;
                shape.size!.width = shape.size!.width - diffx;
            }
            break;
    }
};
