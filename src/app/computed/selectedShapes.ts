import { derived } from 'overmind';
import { Document } from '../types';

export const selectedShapes = derived((currentDocument: Document) => {
  return Object.values(currentDocument.shapes).filter((shape) => shape.selected);
});
