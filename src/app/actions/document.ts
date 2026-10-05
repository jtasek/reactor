import { Action, ActionWithParam, Application, Document } from '../types';
import { createCamera, createDocument, createGrid, newDocumentName } from '../factories';
import { takesEditorInput } from 'src/events/input';
import { copyDocument } from '../services/documentStorage';

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

export const newDocument: Action = ({ state, effects }) => {
    const names = new Set(Object.values(state.documents).map(({ name }) => name));
    let number = 1;

    while (names.has(newDocumentName(number))) {
        number++;
    }

    const document = createDocument({ name: newDocumentName(number) });

    setDocument(state, document);
    state.currentDocumentId = document.id;
    effects.navigate('/');
};

export const requestDocumentReset: Action = ({ state }) => {
    if (takesEditorInput(state) && !state.currentDocument.locked) {
        state.resetDocumentId = state.currentDocumentId;
    }
};

export const cancelDocumentReset: Action = ({ state }) => {
    state.resetDocumentId = null;
};

/** Confirms a reset only for the document for which it was requested. */
export const resetDocument: Action = ({ state }) => {
    const documentId = state.resetDocumentId;
    state.resetDocumentId = null;
    if (
        documentId !== state.currentDocumentId ||
        !takesEditorInput(state) ||
        state.currentDocument.locked
    ) {
        return;
    }
    const document = state.currentDocument;
    document.shapes = {};
    document.shapesIds = [];
    document.layers = {};
    document.groups = {};
    document.links = {};
    document.guides = {};
    document.components = {};
    document.camera = createCamera();
    document.grid = createGrid();
    document.filter = '';
    document.modified = new Date();
    delete document.shownLayerId;
    state.enteredGroupId = null;
};

export const cloneDocument: ActionWithParam<string> = ({ state, effects }, documentId) => {
    const document = getDocument(state, documentId);
    const copy = copyDocument(document, effects.newId());

    copy.name = `${document.name} copy`;
    setDocument(state, copy);
};

/** Removes a document added only to hold saved or shared content that could not be read. */
export const discardDocument: ActionWithParam<string> = ({ state }, documentId) => {
    deleteDocument(state, documentId);
};

export const removeDocument: ActionWithParam<string> = ({ state }, documentId) => {
    deleteDocument(state, documentId);

    if (state.documents[state.currentDocumentId]) {
        return;
    }

    const nextId = Object.keys(state.documents)[0];

    if (nextId) {
        state.currentDocumentId = nextId;

        return;
    }

    const document = createDocument();

    setDocument(state, document);
    state.currentDocumentId = document.id;
};

export const openDocument: ActionWithParam<string> = ({ state }, documentId) => {
    getDocument(state, documentId);

    state.currentDocumentId = documentId;
    state.resetDocumentId = null;
};

export const editDocument: ActionWithParam<string> = ({ actions, effects }, documentId) => {
    actions.openDocument(documentId);
    effects.navigate('/');
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

export const updateDocument: ActionWithParam<Partial<Document> & { id: string }> = (
    { state },
    options
) => {
    const document = getDocument(state, options.id);

    setDocument(state, createDocument({ ...document, ...options }));
};
