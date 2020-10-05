import { derived } from 'overmind';
import { Application } from '../types';

export const filteredShapes = derived(({ currentDocument }: Application) => {
  if (!currentDocument) {
    return [];
  }

  const { filter, shapes } = currentDocument;

  return Object.keys(shapes).filter((key) => {
    const shape = shapes[key];

    return shape.name?.includes(filter);
  });
});
