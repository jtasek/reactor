import { derived } from 'overmind';
import { Application } from '../types';

export const shapesWithTypes = derived(({ currentDocument }: Application) => {
  return Object.values(currentDocument.shapes || []).map((item) => ({
    id: item.id,
    type: item.type
  }));
});
