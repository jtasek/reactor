import { derived } from 'overmind';
import { Application } from '../types';

export const selectedShapes = derived(({ currentDocument }: Application) => {
  return Object.entries(currentDocument.shapes)
    .filter(([_, shape]) => shape.selected)
    .map((item) => item.values);
});
