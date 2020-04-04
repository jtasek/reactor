import { Action } from 'overmind';
import { Application, Layer, HashTable } from '../types';
import { createLayer } from '../factories';

const getLayer = (state: Application, layerId: string) => state.currentDocument?.layers[layerId];

const setLayer = (state: Application, layer: Layer) =>
  (state.currentDocument?.layers[layer.id] = layer);

const deleteLayer = (state: Application, layerId: string) =>
  delete state.currentDocument?.layers[layerId];

export const addLayer: Action<Partial<Layer>> = ({ state }, options) => {
  const layer = createLayer(options);

  setLayer(state, layer);
};

export const cloneLayer: Action<string> = ({ state, effects }, layerId) => {
  const layer = getLayer(state, layerId);

  setLayer(state, { ...layer, id: effects.newId() });
};

export const removeLayer: Action<string> = ({ state }, layerId) => {
  deleteLayer(state, layerId);
};

export const selectLayer: Action<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.selected = true;
};

export const unselectLayer: Action<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.selected = false;
};

export const lockLayer: Action<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.locked = true;
};

export const unlockLayer: Action<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.locked = false;
};

export const showLayer: Action<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.visible = true;
};

export const hideLayer: Action<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.visible = false;
};

export const updateLayer: Action<Partial<Layer> & { id: string }> = ({ state }, options) => {
  const layer = getLayer(state, options.id);

  setLayer(state, { ...layer, ...options });
};
