import { derived } from 'overmind';
import { Application, Document } from '../types';

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
  return Object.keys(currentDocument.shapes);
});

export const selectedShapes = derived((currentDocument: Document) => {
  return Object.values(currentDocument.shapes).filter((shape) => shape.selected);
});

export const selectedShapesIds = derived((currentDocument: Document) => {
  return Object.values(currentDocument.shapes)
    .filter((shape) => shape.selected)
    .map((shape) => shape.id);
});
