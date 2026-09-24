import { createTestStore } from './support/store';

describe('document list actions', () => {
    it('creates a document with the lowest unused name and opens it in the designer', () => {
        const { store, effects } = createTestStore();

        store.actions.updateDocument({ id: 'test-document', name: 'document-1' });
        store.actions.addDocument({ id: 'second', name: 'document-2' });
        store.actions.addDocument({ id: 'fourth', name: 'document-4' });

        store.actions.newDocument();

        expect(store.state.documentsIds).toHaveLength(4);
        expect(store.state.currentDocument.name).toBe('document-3');
        expect(store.state.currentDocument.shapesIds).toEqual([]);
        expect(effects.navigate).toHaveBeenCalledWith('/');
    });

    it('names a clone after its original', () => {
        const { store } = createTestStore();

        store.actions.updateDocument({ id: 'test-document', name: 'Plan' });
        store.actions.cloneDocument('test-document');

        const copyId = store.state.documentsIds.find((id) => id !== 'test-document')!;

        expect(store.state.documents[copyId].name).toBe('Plan copy');
        expect(store.state.currentDocumentId).toBe('test-document');
    });

    it('opens a document in the designer', () => {
        const { store, effects } = createTestStore();

        store.actions.addDocument({ id: 'other' });
        store.actions.editDocument('other');

        expect(store.state.currentDocumentId).toBe('other');
        expect(effects.navigate).toHaveBeenCalledWith('/');
    });
});
