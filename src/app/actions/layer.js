import { createLayer, newId } from '../factories';

const getLayer = (state, layerId) => state.currentDocument.layers[layerId];

const setLayer = (state, layer) =>
  (state.currentDocument.layers[layer.id] = layer);

const deleteLayer = (state, layerId) =>
  delete state.currentDocument.layers[layerId];

export const addLayer = ({ state }, options) => {
  const layer = createLayer(options);

  setLayer(state, layer);
};

export const cloneLayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  setLayer(state, { ...layer, id: newId() });
};

export const removeLayer = ({ state }, layerId) => {
  deleteLayer(state, layerId);
};

export const selectLayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.selected = true;
};

export const unselectLayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.selected = false;
};

export const lockLayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.locked = true;
};

export const unlocklayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.locked = false;
};

export const showLayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.visible = true;
};

export const hideLayer = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.visible = false;
};

export const updateLayer = ({ state }, options) => {
  const layer = getLayer(state, options.id);

  setLayer(state, { ...layer, options });
};
