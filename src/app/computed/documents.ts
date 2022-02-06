import { derived } from 'overmind';
import { Application } from '../types';

export const documentsIds = derived(({ documents }: Application) => {
  return Object.keys(documents);
});
