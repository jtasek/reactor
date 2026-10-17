import { createTestStore } from './support/store';

describe('document list actions', () => {
    it('creates a document with the lowest unused name and opens it in the designer', () => {
        const { store, effects } = createTestStore();

        store.actions.updateDocument({ id: 'test-document', name: 'Untitled' });
        store.actions.addDocument({ id: 'second', name: 'Untitled 2' });
        store.actions.addDocument({ id: 'fourth', name: 'Untitled 4' });

        store.actions.newDocument();

        expect(store.state.documentsIds).toHaveLength(4);
        expect(store.state.currentDocument.name).toBe('Untitled 3');
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
