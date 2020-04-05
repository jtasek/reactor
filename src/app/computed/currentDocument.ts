import { Derive } from 'overmind';
import { Application, Document } from '../types';

export const currentDocument: Derive<Application, Document | null> = ({
  currentDocumentId,
  documents
}) => {
  if (!currentDocumentId) {
    return null;
  }

  return documents[currentDocumentId];
};
