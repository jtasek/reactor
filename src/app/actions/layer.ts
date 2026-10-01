import { Action, ActionWithParam, Application, Layer } from '../types';
import { createLayer } from '../factories';
import { LAYER_MINIMUM, editableSelectedShapesIds, removeFromContainers } from '../membership';
import { isShapeVisible } from '../utils';

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

/**
 * Moves the selected shapes the commands may change into a new layer, out of
 * their layers, as a shape is on one layer at most. Layers left empty are removed.
 */
export const layerSelection: Action = ({ state }) => {
    const { currentDocument } = state;
    const shapesIds = editableSelectedShapesIds(currentDocument);

    if (shapesIds.length < LAYER_MINIMUM) {
        return;
    }

    removeFromContainers(currentDocument.layers, shapesIds, LAYER_MINIMUM);
    setLayer(state, createLayer({ shapesIds }));
};

/** Takes the selected shapes the commands may change off their layers, removing layers left empty. */
export const unlayerSelection: Action = ({ state }) => {
    const { currentDocument } = state;

    removeFromContainers(
        currentDocument.layers,
        editableSelectedShapesIds(currentDocument),
        LAYER_MINIMUM
    );
};

/** Selects a layer's shown shapes, or unselects them when it is selected. */
export const toggleLayerSelected: ActionWithParam<string> = ({ state }, layerId) => {
    const { currentDocument } = state;
    const layer = getLayer(state, layerId);
    const selected = !currentDocument.selectedLayersIds.includes(layerId);

    layer.shapesIds
        .filter((id) => isShapeVisible(currentDocument, id))
        .forEach((id) => {
            currentDocument.shapes[id].selected = selected;
        });
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

export const updateLayer: ActionWithParam<Partial<Layer> & { id: string }> = (
    { state },
    options
) => {
    const layer = getLayer(state, options.id);

    setLayer(state, { ...layer, ...options });
};
