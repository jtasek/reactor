import {
    Action,
    ActionWithParam,
    Application,
    Document,
    DocumentsLayout,
    UndoHistory
} from '../types';
import { createCamera, createDocument, createGrid, newDocumentName } from '../factories';
import { takesEditorInput } from 'src/events/input';
import { copyDocument } from '../services/documentStorage';
import { DOCUMENTS_LAYOUT_KEY, deletedForGood } from '../documentList';

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

/** Opens another document than one deleted, or a new one when none is left outside Recently Deleted. */
const replaceCurrentDocument = (state: Application, documentId: string) => {
    if (state.currentDocumentId !== documentId && state.documents[state.currentDocumentId]) {
        return;
    }

    state.enteredComponentId = null;

    const nextId = Object.keys(state.documents).find(
        (id) => id !== documentId && !state.documents[id].deleted
    );

    if (nextId) {
        state.currentDocumentId = nextId;

        return;
    }

    const document = createDocument();

    setDocument(state, document);
    state.currentDocumentId = document.id;
};

export const addDocument: ActionWithParam<Partial<Document>> = ({ state }, options) => {
    const document = createDocument(options);

    setDocument(state, document);
};

export const setDocumentsLayout: ActionWithParam<DocumentsLayout> = (
    { state, effects },
    layout
) => {
    state.config.documentsLayout = layout;
    try {
        effects.saveState(DOCUMENTS_LAYOUT_KEY, layout);
    } catch {
        // Keep the layout for this session if local storage is unavailable.
    }
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
    state.enteredComponentId = null;
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
    delete document.shownLayerId;
    delete document.surfaceSelected;
    state.enteredGroupId = null;
    state.enteredComponentId = null;
};

export const cloneDocument: ActionWithParam<string> = ({ state, effects }, documentId) => {
    const document = getDocument(state, documentId);
    const copy = copyDocument(document, effects.newId());

    copy.name = `${document.name} copy`;
    delete copy.deleted;
    copy.created = new Date();
    copy.modified = new Date(copy.created);
    setDocument(state, copy);
};

/** Records the time of a local edit before it is saved and shared. */
export const markDocumentModified: ActionWithParam<string> = ({ state }, documentId) => {
    getDocument(state, documentId).modified = new Date();
};

/** Shows what this copy can undo and redo of a document. */
export const setDocumentHistory: ActionWithParam<{ documentId: string; history: UndoHistory }> = (
    { state },
    { documentId, history }
) => {
    const document = state.documents[documentId];

    if (!document) {
        return;
    }

    document.history = history;
};

/** Removes a document added only to hold saved or shared content that could not be read. */
export const discardDocument: ActionWithParam<string> = ({ state }, documentId) => {
    deleteDocument(state, documentId);
};

export const removeDocument: ActionWithParam<string> = ({ state }, documentId) => {
    deleteDocument(state, documentId);
    replaceCurrentDocument(state, documentId);
};

/** Moves a document to Recently Deleted, from where it can be restored. */
export const trashDocument: ActionWithParam<string> = ({ state }, documentId) => {
    getDocument(state, documentId).deleted = new Date();
    replaceCurrentDocument(state, documentId);
};

export const restoreDocument: ActionWithParam<string> = ({ state }, documentId) => {
    delete getDocument(state, documentId).deleted;
};

/** Deletes for good the documents Recently Deleted has kept for its days. */
export const purgeDeletedDocuments: Action = ({ state }) => {
    const now = new Date();

    Object.values(state.documents)
        .filter(({ deleted }) => deleted && deletedForGood(deleted, now))
        .forEach(({ id }) => {
            deleteDocument(state, id);
            replaceCurrentDocument(state, id);
        });
};

export const openDocument: ActionWithParam<string> = ({ state }, documentId) => {
    getDocument(state, documentId);

    state.currentDocumentId = documentId;
    state.enteredComponentId = null;
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
