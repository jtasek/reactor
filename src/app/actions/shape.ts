import { Application, Shape } from '../types';
import { createShape } from '../factories';
import { Context } from '../hooks';
import { Pointer } from 'src/events/types';
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

export const addShape = ({ state }: Context, options: Partial<Shape>) => {
  const shape = createShape(options);

  setShape(state, shape);
};

export const cloneShape = ({ state, effects }: Context, shapeId: string) => {
  const shape = getShape(state, shapeId);

  setShape(state, { ...shape, id: effects.newId() });
};

export const removeShape = ({ state }: Context, shapeId: string) => {
  deleteShape(state, shapeId);
};

export const toggleShapeSelected = ({ state }: Context, shapeId: string) => {
  const shape = getShape(state, shapeId);

  shape.selected = !shape.selected;
};

export const selectShape = ({ state }: Context, args: { shapeId: string }) => {
  const shape = getShape(state, args.shapeId);

  shape.selected = true;
};

export const selectShapeByPoint = ({ state }: Context) => {
  const { position } = state.events.pointer;

  const shapes = Object.values(state.currentDocument.shapes);
  shapes.forEach((shape) => {
    if (isPointInBox(position, shape)) {
      shape.selected = true;
    }
  });
};

export const selectShapes = ({ state }: Context) => {
  const { topLeftPosition, bottomRightPosition } = state.events.pointer;

  const source = { topLeft: topLeftPosition, bottomRight: bottomRightPosition };

  const shapes = Object.values(state.currentDocument.shapes);
  shapes.forEach((shape) => {
    if (overlaps(source, getBoundingBox(shape))) {
      shape.selected = true;
    }
  });
};

export const unselectShape = ({ state }: Context, shapeId: string) => {
  const shape = getShape(state, shapeId);

  shape.selected = false;
};

export const lockShape = ({ state }: Context, shapeId: string) => {
  const shape = getShape(state, shapeId);

  shape.locked = true;
};

export const unlockShape = ({ state }: Context, shapeId: string) => {
  const shape = getShape(state, shapeId);

  shape.locked = false;
};

export const showShape = ({ state }: Context, shapeId: string) => {
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

  if (shape.type === 'circle') {
    const diffx = pointer.position.x - shape.cx!;
    const diffy = pointer.position.y - shape.cy!;

    shape.r = Math.max(diffx, diffy);
    return;
  }

  const diffx = pointer.position.x - shape.position!.x;
  const diffy = pointer.position.y - shape.position!.y;

  const topLeft = shape.position;
  const bottomRight = { x: topLeft!.x + shape.size!.width, y: topLeft!.y + shape.size!.height };

  switch (type) {
    case 'topLeft':
      if (pointer.position.y < bottomRight.y) {
        shape.position!.y = pointer.position.y;
        shape.size!.height -= diffy;
      }
      if (pointer.position.x < bottomRight.x) {
        shape.position!.x = pointer.position.x;
        shape.size!.width = shape.size!.width - diffx;
      }
      break;
    case 'middleTop':
      if (pointer.position.y < bottomRight.y) {
        shape.position!.y = pointer.position.y;
        shape.size!.height -= diffy;
      }
      break;
    case 'topRight':
      if (pointer.position.x > topLeft!.x) {
        shape.size!.width = diffx;
      }
      if (pointer.position.y < bottomRight!.y) {
        shape.position!.y = pointer.position.y;
        shape.size!.height -= diffy;
      }
      break;
    case 'middleRight':
      if (pointer.position.x > shape.position!.x) {
        shape.size!.width = diffx;
      }
      break;
    case 'bottomRight':
      if (pointer.position.x > shape.position!.x) {
        shape.size!.width = diffx;
      }
      if (pointer.position.y > shape.position!.y) {
        shape.size!.height = diffy;
      }
      break;
    case 'middleBottom':
      if (pointer.position.y > shape.position!.y) {
        shape.size!.height = diffy;
      }
      break;
    case 'bottomLeft':
      if (pointer.position.x < bottomRight!.x) {
        shape.position!.x = pointer.position.x;
        shape.size!.width = shape.size!.width - diffx;
      }
      if (pointer.position.y > topLeft!.y) {
        shape.size!.height = diffy;
      }
      break;
    case 'middleLeft':
      if (pointer.position.x < bottomRight!.x) {
        shape.position!.x = pointer.position.x;
        shape.size!.width = shape.size!.width - diffx;
      }
      break;
  }
};
