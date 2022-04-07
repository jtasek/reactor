import { Application, Action, Shape } from '../types';
import { createShape } from '../factories';
import { Context } from '../hooks';

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

export const selectShape = ({ state }: Context, shapeId: string) => {
  const shape = getShape(state, shapeId);

  shape.selected = true;
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
