import { derived } from 'overmind';
import { Application, Document, Shape } from '../types';
import { isShapeVisible } from '../utils';

const byDrawingOrder = (a: Shape, b: Shape) => {
    if (a.order !== b.order) {
        return a.order < b.order ? -1 : 1;
    }

    return a.id < b.id ? -1 : 1;
};

export const commandsIds = derived(({ commands }: Application) => {
    return Object.keys(commands);
});

export const componentsIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.components);
});

export const groupsIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.groups);
});

export const selectedGroupsIds = derived((currentDocument: Document) => {
    return Object.values(currentDocument.groups)
        .filter((group) => group.selected)
        .map((group) => group.id);
});

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

export const rulersIds = derived((currentDocument: Document) => {
    return Object.keys(currentDocument.rulers);
});

export const shapesIds = derived((currentDocument: Document) => {
    return Object.values(currentDocument.shapes)
        .sort(byDrawingOrder)
        .map((shape) => shape.id);
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
