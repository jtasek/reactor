import { createDocument } from '../factories';

const getDocument = (state, documentId) => state.documents[documentId];

const setDocument = (state, document) => (state.documents[document.id] = document);

const deleteDocument = (state, documentId) => delete state.documents[documentId];

export const addDocument = ({ state }, options) => {
  const document = createDocument(options);

  setDocument(state, document);
};

export const cloneDocument = ({ state, effects }, documentId) => {
  const document = getDocument(state, documentId);

  setDocument(state, { ...document, id: effects.newId() });
};

export const removeDocument = ({ state }, documentId) => {
  deleteDocument(state, documentId);
};

export const selectDocument = ({ state }, documentId) => {
  const document = getDocument(state, documentId);

  document.selected = true;
};

export const unselectDocument = ({ state }, documentId) => {
  const document = getDocument(state, documentId);

  document.selected = false;
};

export const lockDocument = ({ state }, documentId) => {
  const document = getDocument(state, documentId);

  document.locked = true;
};

export const unlockDocument = ({ state }, documentId) => {
  const document = getDocument(state, documentId);

  document.locked = false;
};

export const updateDocument = ({ state }, options) => {
  const document = getDocument(state, options.id);

  setDocument(state, { ...document, options });
};
