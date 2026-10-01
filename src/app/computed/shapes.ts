import { derived } from 'overmind';
import { Application, Document } from '../types';
import { isShapeVisible } from '../utils';
import { containersHolding } from '../membership';

export const commandsIds = derived(({ commands }: Application) => {
    return Object.keys(commands);
});

export const componentsIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.components);
});

export const groupsIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.groups);
});

/** The groups holding a selected shape. */
export const selectedGroupsIds = derived((currentDocument: Document) => {
    return containersHolding(currentDocument.groups, currentDocument.selectedShapesIds).map(
        (group) => group.id
    );
});

export const layersIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.layers);
});

/** The layers holding a selected shape. */
export const selectedLayersIds = derived((currentDocument: Document) => {
    return containersHolding(currentDocument.layers, currentDocument.selectedShapesIds).map(
        (layer) => layer.id
    );
});

export const linksIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.links);
});

export const rulersIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.rulers);
});

// The selection commands act on: a hidden shape keeps its `selected` flag but is
// left out until it is shown again.
export const selectedShapes = derived((currentDocument: Document) => {
    return Object.values(currentDocument.shapes).filter(
        (shape) => shape.selected && isShapeVisible(currentDocument, shape.id)
    );
});

export const selectedShapesIds = derived((currentDocument: Document) => {
    return Object.values(currentDocument.shapes)
        .filter((shape) => shape.selected && isShapeVisible(currentDocument, shape.id))
        .map((shape) => shape.id);
});
