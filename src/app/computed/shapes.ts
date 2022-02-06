import { derived } from 'overmind';
import { Document } from '../types';

export const componentsIds = derived((currentDocument: Document) => {
  return Object.keys(currentDocument.components);
});

export const groupsIds = derived((currentDocument: Document) => {
  return Object.keys(currentDocument.groups);
});

export const layersIds = derived((currentDocument: Document) => {
  return Object.keys(currentDocument.layers);
});

export const linksIds = derived((currentDocument: Document) => {
  return Object.keys(currentDocument.links);
});

export const rulersIds = derived((currentDocument: Document) => {
  return Object.keys(currentDocument.rulers);
});

export const shapesIds = derived((currentDocument: Document) => {
  return Object.keys(currentDocument.shapes);
});

export const selectedShapes = derived((currentDocument: Document) => {
  return Object.values(currentDocument.shapes).filter((shape) => shape.selected);
});

export const selectedShapesIds = derived((currentDocument: Document) => {
  return Object.values(currentDocument.shapes)
    .filter((shape) => shape.selected)
    .map((shape) => shape.id);
})