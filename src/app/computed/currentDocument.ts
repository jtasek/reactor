import { derived } from 'overmind';
import { Application } from '../types';

export const currentDocument = derived(({ currentDocumentId, documents }: Application) => {
  return documents[currentDocumentId];
});
