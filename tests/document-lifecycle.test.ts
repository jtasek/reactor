import { describe, expect, it } from 'vitest';
import { createApplication } from '../src/app/factories';
import { createTestStore } from './support/store';

describe('document ownership', () => {
    it('uses matching document keys and IDs', () => {
        const app = createApplication();
        expect(app.documents[app.currentDocumentId].id).toBe(app.currentDocumentId);
    });

    it('clones nested content independently', () => {
        const { store } = createTestStore();

        store.actions.addShape({ type: 'rectangle', size: { width: 30, height: 40 } });

        const original = store.state.currentDocument;

        store.actions.cloneDocument(original.id);

        const copyId = store.state.documentsIds.find((id) => id !== original.id)!;

        store.actions.updateDocument({ id: copyId, name: 'Copy' });
        store.actions.openDocument(copyId);
        store.actions.tools.panCamera({ dx: 10, dy: 20 });

        const shapeId = store.state.currentDocument.shapesIds[0];

        store.actions.updateShape({ id: shapeId, size: { width: 99, height: 100 } });

        expect(original.camera.position).toEqual({ x: 0, y: 0 });
        expect(original.shapes[shapeId].size).toEqual({ width: 30, height: 40 });

        store.actions.addShape({ type: 'rectangle', size: { width: 5, height: 6 } });
        expect(store.state.currentDocument.shapesIds).toHaveLength(2);
        expect(original.shapesIds).toHaveLength(1);
    });

    it('keeps a valid active document when the last document is deleted', () => {
        const { store } = createTestStore();
        store.actions.removeDocument(store.state.currentDocumentId);
        expect(store.state.currentDocument).toBeDefined();
        expect(store.state.currentDocument.id).toBe(store.state.currentDocumentId);
    });
});
