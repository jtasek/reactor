import { createDocument, newId } from '../factories';

const getDocument = (state, documentId) =>
  state.currentDocument.documents[documentId];

const setDocument = (state, document) =>
  (state.currentDocument.documents[document.id] = document);

const deleteDocument = (state, documentId) =>
  delete state.currentDocument.documents[documentId];

export const addDocument = ({ state }, options) => {
  const document = createDocument(options);

  setDocument(state, document);
};

export const cloneDocument = ({ state }, documentId) => {
  const document = getDocument(state, documentId);

  setDocument(state, { ...document, id: newId() });
};

export const removeDocument = ({ state }, documentId) => {
  deleteDocument(state, documentId);
};

export const selectDocument = ({ state }, documentId) => {
  state.currentDocumentId = documentId;
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

export const showDocument = ({ state }, documentId) => {
  const document = getDocument(state, documentId);

  document.visible = true;
};

export const hideDocument = ({ state }, documentId) => {
  const document = getDocument(state, documentId);

  document.visible = false;
};

export const updateDocument = ({ state }, options) => {
  const document = getDocument(state, options.id);

  setDocument(state, { ...document, options });
};
