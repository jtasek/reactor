import { derived } from 'overmind';
import { Application, Document } from '../types';
import { isShapeVisible } from '../utils';
import {
    editableSelectedShapesIds as findEditableSelectedShapesIds,
    groupFrame,
    listMovableSelectedItems,
    selectedGroupsIdsOf,
    selectionExtent as findSelectionExtent
} from '../membership';

export const commandsIds = derived(({ commands }: Application) => {
    return Object.keys(commands);
});

export const componentsIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.components);
});

export const groupsIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.groups);
});

/** The groups selected as one: see `selectedGroupsIdsOf`. */
export const selectedGroupsIds = derived(
    (currentDocument: Document, { enteredGroupId }: Application) =>
        selectedGroupsIdsOf(currentDocument, enteredGroupId)
);

/** Each group's box and rotation, kept until its shapes change; none without a shown shape. */
export const groupFrames = derived((currentDocument: Document) =>
    Object.fromEntries(
        Object.values(currentDocument.groups).map((group) => [
            group.id,
            groupFrame(currentDocument, group) ?? undefined
        ])
    )
);

export const layersIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.layers);
});

export const selectedLayersIds = derived((currentDocument: Document) => {
    return Object.values(currentDocument.layers)
        .filter((layer) => layer.selected)
        .map((layer) => layer.id);
});

export const linksIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.links);
});

export const guidesIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.guides);
});

// The selection commands act on: a hidden shape keeps its `selected` flag but is
// left out until it is shown again.
export const selectedShapes = derived((currentDocument: Document) => {
    return Object.values(currentDocument.shapes).filter(
        (shape) => shape.selected && isShapeVisible(currentDocument, shape.id)
    );
});

/** The box around the selected shapes, kept until they change: see `selectionExtent`. */
export const selectionExtent = derived((currentDocument: Document) =>
    findSelectionExtent(currentDocument)
);

/** The selected items Align and Space may move, kept until they change: see `listMovableSelectedItems`. */
export const movableSelectedItems = derived((currentDocument: Document) =>
    listMovableSelectedItems(currentDocument)
);

/** The selected shapes commands may change, kept until they change: see `editableSelectedShapesIds`. */
export const editableSelectedShapesIds = derived((currentDocument: Document) =>
    findEditableSelectedShapesIds(currentDocument)
);

export const selectedShapesIds = derived((currentDocument: Document) => {
    return Object.values(currentDocument.shapes)
        .filter((shape) => shape.selected && isShapeVisible(currentDocument, shape.id))
        .map((shape) => shape.id);
});
