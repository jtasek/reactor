import { ActionWithParam, Application, Document } from '../types';
import { createDocument } from '../factories';

const getDocument = ({ documents }: Application, documentId: string) => {
  const document = documents[documentId];

  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  return document;
};

const setDocument = ({ documents }: Application, document: Document) =>
  (documents[document.id] = document);

const deleteDocument = ({ documents }: Application, documentId: string) => {
  delete documents[documentId];
};

export const addDocument: ActionWithParam<Partial<Document>> = ({ state }, options) => {
  const document = createDocument(options);

  setDocument(state, document);
};

export const cloneDocument: ActionWithParam<string> = ({ state, effects }, documentId) => {
  const document = getDocument(state, documentId);

  setDocument(state, { ...document, id: effects.newId() });
};

export const removeDocument: ActionWithParam<string> = ({ state }, documentId) => {
  deleteDocument(state, documentId);
};

export const selectDocument: ActionWithParam<string> = ({ state }, documentId) => {
  const document = getDocument(state, documentId);

  document.selected = true;
};

export const unselectDocument: ActionWithParam<string> = ({ state }, documentId) => {
  const document = getDocument(state, documentId);

  document.selected = false;
};

export const lockDocument: ActionWithParam<string> = ({ state }, documentId) => {
  const document = getDocument(state, documentId);

  document.locked = true;
};

export const unlockDocument: ActionWithParam<string> = ({ state }, documentId) => {
  const document = getDocument(state, documentId);

  document.locked = false;
};

export const updateDocument: ActionWithParam<Partial<Document> & { id: string }> = ({ state }, options) => {
  const document = getDocument(state, options.id);

  setDocument(state, { ...document, ...options });
};
