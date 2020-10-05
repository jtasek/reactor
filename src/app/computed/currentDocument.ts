import { derived } from 'overmind';
import { Application } from '../types';

export const currentDocument = derived(({ currentDocumentId, documents }: Application) => {
  if (!currentDocumentId) {
    return null;
  }

  return documents[currentDocumentId];
});
