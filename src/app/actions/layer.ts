import { ActionWithParam, Application, Layer } from '../types';
import { createLayer } from '../factories';

const getLayer = ({ currentDocument }: Application, layerId: string) => {
  const layer = currentDocument.layers[layerId];

  if (!layer) {
    throw new Error(`Layer ${layerId} not found`);
  }

  return layer;
};

const setLayer = ({ currentDocument }: Application, layer: Layer) => {
  if (currentDocument) {
    currentDocument.layers[layer.id] = layer;
  }
};

const deleteLayer = ({ currentDocument }: Application, layerId: string) =>
  delete currentDocument.layers[layerId];

export const addLayer: ActionWithParam<Partial<Layer>> = ({ state }, options) => {
  const layer = createLayer(options);

  setLayer(state, layer);
};

export const cloneLayer: ActionWithParam<string> = ({ state, effects }, layerId) => {
  const layer = getLayer(state, layerId);

  setLayer(state, { ...layer, id: effects.newId() });
};

export const removeLayer: ActionWithParam<string> = ({ state }, layerId) => {
  deleteLayer(state, layerId);
};

export const toggleLayerSelected: ActionWithParam<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.selected = !layer.selected;
};

export const unselectLayer: ActionWithParam<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.selected = false;
};

export const toggleLayerLocked: ActionWithParam<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.locked = !layer.locked;
};

export const lockLayer: ActionWithParam<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.locked = true;
};

export const unlockLayer: ActionWithParam<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.locked = false;
};

export const showLayer: ActionWithParam<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.visible = true;
};

export const hideLayer: ActionWithParam<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.visible = false;
};

export const toggleLayerVisible: ActionWithParam<string> = ({ state }, layerId) => {
  const layer = getLayer(state, layerId);

  layer.visible = !layer.visible;
};

export const updateLayer: ActionWithParam<Partial<Layer> & { id: string }> = ({ state }, options) => {
  const layer = getLayer(state, options.id);

  setLayer(state, { ...layer, ...options });
};
