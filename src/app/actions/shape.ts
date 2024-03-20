import type { Pointer } from 'src/events/types';
import { Action, ActionWithParam, Application, Circle, Shape } from '../types';
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
        type: string;
        pointer: Pointer;
    }
) => {
    const { shapeId, type, pointer } = payload;
    const shape = getShape(state, shapeId);

    const diffx = pointer.current.x - shape.position.x;
    const diffy = pointer.current.y - shape.position.y;

    if (shape.type === 'circle') {
        const radiusChange = Math.sqrt(Math.pow(diffx, 2) + Math.pow(diffy, 2));
        (shape as Circle).radius = (shape as Circle).radius + radiusChange;
        return;
    }

    const topLeft = shape.position;
    const bottomRight = { x: topLeft!.x + shape.size!.width, y: topLeft!.y + shape.size!.height };

    switch (type) {
        case 'topLeft':
            if (pointer.current.y < bottomRight.y) {
                shape.position!.y = pointer.current.y;
                shape.size!.height -= diffy;
            }
            if (pointer.current.x < bottomRight.x) {
                shape.position!.x = pointer.current.x;
                shape.size!.width = shape.size!.width - diffx;
            }
            break;
        case 'middleTop':
            if (pointer.current.y < bottomRight.y) {
                shape.position!.y = pointer.current.y;
                shape.size!.height -= diffy;
            }
            break;
        case 'topRight':
            if (pointer.current.x > topLeft!.x) {
                shape.size!.width = diffx;
            }
            if (pointer.current.y < bottomRight!.y) {
                shape.position!.y = pointer.current.y;
                shape.size!.height -= diffy;
            }
            break;
        case 'middleRight':
            if (pointer.current.x > shape.position!.x) {
                shape.size!.width = diffx;
            }
            break;
        case 'bottomRight':
            if (pointer.current.x > shape.position!.x) {
                shape.size!.width = diffx;
            }
            if (pointer.current.y > shape.position!.y) {
                shape.size!.height = diffy;
            }
            break;
        case 'middleBottom':
            if (pointer.current.y > shape.position!.y) {
                shape.size!.height = diffy;
            }
            break;
        case 'bottomLeft':
            if (pointer.current.x < bottomRight!.x) {
                shape.position!.x = pointer.current.x;
                shape.size!.width = shape.size!.width - diffx;
            }
            if (pointer.current.y > topLeft!.y) {
                shape.size!.height = diffy;
            }
            break;
        case 'middleLeft':
            if (pointer.current.x < bottomRight!.x) {
                shape.position!.x = pointer.current.x;
                shape.size!.width = shape.size!.width - diffx;
            }
            break;
    }
};
