import { Action, ActionWithParam, Application, Layer } from '../types';
import { createLayer } from '../factories';
import { LAYER_MINIMUM, editableSelectedShapesIds, putShapesOnLayer } from '../membership';
import { isShapeLocked } from '../utils';

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
 * The selected shapes the commands may change, with the other shapes of the
 * groups selected as one, as a group is on one layer.
 */
const selectionWithGroups = ({ currentDocument }: Application): string[] => {
    const grouped = currentDocument.selectedGroupsIds.flatMap(
        (id) => currentDocument.groups[id].shapesIds
    );

    return [...new Set([...editableSelectedShapesIds(currentDocument), ...grouped])].filter(
        (id) => !isShapeLocked(currentDocument, id)
    );
};

/**
 * Moves the selected shapes the commands may change into a new layer, out of
 * their layers, as a shape is on one layer at most. Layers left empty are removed.
 */
export const layerSelection: Action = ({ state }) => {
    const shapesIds = selectionWithGroups(state);

    if (shapesIds.length < LAYER_MINIMUM) {
        return;
    }

    const layer = createLayer();

    setLayer(state, layer);
    putShapesOnLayer(state.currentDocument, shapesIds, layer.id);
};

/** Takes the selected shapes the commands may change off their layers, removing layers left empty. */
export const unlayerSelection: Action = ({ state }) => {
    putShapesOnLayer(state.currentDocument, selectionWithGroups(state), null);
};

/** Puts shapes that are not locked on a layer, or on none. */
export const moveShapesToLayer: ActionWithParam<{ shapeIds: string[]; layerId: string | null }> = (
    { state },
    { shapeIds, layerId }
) => {
    const { currentDocument } = state;

    if (layerId !== null && !currentDocument.layers[layerId]) {
        return;
    }

    putShapesOnLayer(
        currentDocument,
        shapeIds.filter((id) => !isShapeLocked(currentDocument, id)),
        layerId
    );
};

/**
 * Shows one layer only on this screen, with the shapes on no layer, or every
 * layer again when it is the one shown. Layers keep their own visibility.
 */
export const showOnlyLayer: ActionWithParam<string> = ({ state }, layerId) => {
    const { currentDocument } = state;

    if (currentDocument.shownLayerId === layerId) {
        delete currentDocument.shownLayerId;

        return;
    }

    currentDocument.shownLayerId = layerId;
};

export const showAllLayers: Action = ({ state }) => {
    delete state.currentDocument.shownLayerId;
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

export const updateLayer: ActionWithParam<Partial<Layer> & { id: string }> = (
    { state },
    options
) => {
    const layer = getLayer(state, options.id);

    setLayer(state, { ...layer, ...options });
};
