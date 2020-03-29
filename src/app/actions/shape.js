import { createShape, newId } from '../factories';

const getShape = (state, shapeId) => state.currentDocument.shapes[shapeId];

const setShape = (state, shape) =>
  (state.currentDocument.shapes[shape.id] = shape);

const deleteShape = (state, shapeId) =>
  delete state.currentDocument.shapes[shapeId];

export const addshape = ({ state }, options) => {
  const shape = createShape(options);

  setShape(state, shape);
};

export const cloneshape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  setShape(state, { ...shape, id: newId() });
};

export const removeshape = ({ state }, shapeId) => {
  deleteShape(state, shapeId);
};

export const selectshape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.selected = true;
};

export const unselectshape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.selected = false;
};

export const lockshape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.locked = true;
};

export const unlockshape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.locked = false;
};

export const showshape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.visible = true;
};

export const hideshape = ({ state }, shapeId) => {
  const shape = getShape(state, shapeId);

  shape.visible = false;
};

export const updateshape = ({ state }, options) => {
  const shape = getShape(state, options.id);

  setShape(state, { ...shape, options });
};
