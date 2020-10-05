import { derived } from 'overmind';
import { Application } from '../types';

export const selectedShapes = derived(({ currentDocument }: Application) => {
  if (!currentDocument) {
    return [];
  }

  return Object.keys(currentDocument?.shapes).filter(
    (key) => currentDocument?.shapes[key].selected
  );
});
