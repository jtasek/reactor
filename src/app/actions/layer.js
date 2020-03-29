import { createLayer, newId } from '../factories';

const getLayer = (state, layerId) => state.currentDocument.layers[layerId];

const setLayer = (state, layer) =>
  (state.currentDocument.layers[layer.id] = layer);

const deleteLayer = (state, layerId) =>
  delete state.currentDocument.layers[layerId];

export const addlayer = ({ state }, options) => {
  const layer = createLayer(options);

  setLayer(state, layer);
};

export const clonelayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  setLayer(state, { ...layer, id: newId() });
};

export const removelayer = ({ state }, layerId) => {
  deleteLayer(state, layerId);
};

export const selectlayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.selected = true;
};

export const unselectlayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.selected = false;
};

export const locklayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.locked = true;
};

export const unlocklayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.locked = false;
};

export const showlayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.visible = true;
};

export const hidelayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.visible = false;
};

export const updatelayer = ({ state }, options) => {
  const layer = getLayer(state, options.id);

  setLayer(state, { ...layer, options });
};
