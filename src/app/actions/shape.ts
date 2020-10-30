import { Action } from 'overmind';
import { Application, Shape } from '../types';
import { createShape } from '../factories';

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

export const addShape: Action<Partial<Shape>> = ({ state }, options) => {
  const shape = createShape(options);

  setShape(state, shape);
};

export const cloneShape: Action<string> = ({ state, effects }, shapeId) => {
  const shape = getShape(state, shapeId);

  setShape(state, { ...shape, id: effects.newId() });
};

export const removeShape: Action<string> = ({ state }, shapeId) => {
  deleteShape(state, shapeId);
};

export const selectShape: Action<string> = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.selected = true;
};

export const unselectShape: Action<string> = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.selected = false;
};

export const lockShape: Action<string> = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.locked = true;
};

export const unlockShape: Action<string> = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.locked = false;
};

export const showShape: Action<string> = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.visible = true;
};

export const hideShape: Action<string> = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.visible = false;
};

export const updateShape: Action<Partial<Shape> & { id: string }> = ({ state }, options) => {
  const shape = getShape(state, options.id);

  setShape(state, { ...shape, ...options });
};
