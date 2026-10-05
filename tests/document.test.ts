import { createTestStore } from './support/store';

describe('reset document', () => {
    it('clears content while retaining the document identity and label', () => {
        const { store } = createTestStore();
        const document = store.state.currentDocument;
        const documentId = document.id;
        store.actions.updateDocument({ id: documentId, name: 'Design' });
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 10, y: 20 },
            size: { width: 30, height: 40 }
        });
        store.actions.addLayer({ id: 'layer', name: 'Layer' });
        store.actions.showOnlyLayer('layer');

        store.actions.requestDocumentReset();
        expect(store.state.currentDocument.shapesIds).toHaveLength(1);
        store.actions.resetDocument();

        expect(store.state.currentDocument).toMatchObject({
            id: documentId,
            name: 'Design',
            shapes: {},
            layers: {},
            links: {},
            groups: {},
            guides: {}
        });
        const reset = store.state.currentDocument;
        for (const content of [
            reset.shapes,
            reset.layers,
            reset.groups,
            reset.links,
            reset.guides
        ]) {
            expect(content).toEqual({});
        }
        expect(reset.shapesIds).toEqual([]);
        expect(reset.layersIds).toEqual([]);
        expect(reset.shownLayerId).toBeUndefined();
        expect(store.state.resetDocumentId).toBeNull();
    });

    it('requires a pending confirmation and leaves content intact on cancellation', () => {
        const { store } = createTestStore();
        store.actions.addLayer({ id: 'layer' });
        store.actions.resetDocument();
        expect(store.state.currentDocument.layersIds).toEqual(['layer']);
        store.actions.requestDocumentReset();
        store.actions.cancelDocumentReset();
        store.actions.resetDocument();
        expect(store.state.currentDocument.layersIds).toEqual(['layer']);
    });

    it('checks the lock again when confirming', () => {
        const { store } = createTestStore();
        store.actions.addLayer({ id: 'layer' });
        store.actions.requestDocumentReset();
        store.actions.lockDocument(store.state.currentDocumentId);
        store.actions.resetDocument();
        expect(store.state.currentDocument.layersIds).toEqual(['layer']);
        store.actions.requestDocumentReset();
        expect(store.state.resetDocumentId).toBeNull();
    });

    it('cancels a request when switching documents', () => {
        const { store } = createTestStore();
        store.actions.addDocument({ id: 'other' });
        store.actions.requestDocumentReset();
        store.actions.openDocument('other');
        store.actions.addLayer({ id: 'layer' });
        store.actions.resetDocument();
        expect(store.state.currentDocument.layersIds).toEqual(['layer']);
    });
});
