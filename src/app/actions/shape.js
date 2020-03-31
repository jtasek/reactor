import { createShape } from '../factories';

const getShape = (state, shapeId) => state.currentDocument.shapes[shapeId];

const setShape = (state, shape) =>
  (state.currentDocument.shapes[shape.id] = shape);

const deleteShape = (state, shapeId) =>
  delete state.currentDocument.shapes[shapeId];

export const addShape = ({ state }, options) => {
  const shape = createShape(options);

  setShape(state, shape);
};

export const cloneShape = ({ state, effects}, shapeId) => {
  const shape = getShape(state, shapeId);

  setShape(state, { ...shape, id: effects.newId() });
};

export const removeShape = ({ state }, shapeId) => {
  deleteShape(state, shapeId);
};

export const selectShape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.selected = true;
};

export const unselectShape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.selected = false;
};

export const lockShape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.locked = true;
};

export const unlockShape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.locked = false;
};

export const showShape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.visible = true;
};

export const hideShape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.visible = false;
};

export const updateShape = ({ state }, options) => {
  const shape = getShape(state, options.id);

  setShape(state, { ...shape, options });
};
