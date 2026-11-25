import { describe, expect, it } from 'vitest';
import { componentLibraries } from 'src/app/computed/componentPanels';
import { createComponent } from 'src/app/factories';
import {
    migratePersistedState,
    restoreDocuments,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';

function savedTemplate() {
    const { store } = createTestStore();

    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 30, height: 40 }
    });

    const original = store.state.currentDocument;

    store.actions.updateDocument({ id: original.id, name: 'Checkout' });
    store.actions.saveAsTemplate(original.id);

    const templateId = store.state.documentsIds.find((id) => id !== original.id)!;

    return { store, originalId: original.id, templateId };
}

describe('saved templates', () => {
    it('keeps a copy of the document as a template and leaves the document as it was', () => {
        const { store, originalId, templateId } = savedTemplate();
        const template = store.state.documents[templateId];

        expect(template).toMatchObject({ name: 'Checkout', template: true });
        expect(template.shapesIds).toEqual(store.state.documents[originalId].shapesIds);
        expect(store.state.documents[originalId].template).toBeUndefined();
        expect(store.state.currentDocumentId).toBe(originalId);
    });

    it('opens a new document from the template under a name not yet taken', () => {
        const { store, originalId, templateId } = savedTemplate();

        store.actions.newDocumentFromSavedTemplate({ templateId, id: 'from-template' });

        const document = store.state.documents['from-template'];

        expect(store.state.currentDocumentId).toBe('from-template');
        expect(document.template).toBeUndefined();
        expect(document.name).toBe('Checkout 2');
        expect(document.shapesIds).toEqual(store.state.documents[originalId].shapesIds);
        expect(store.state.documents[templateId].template).toBe(true);
    });

    it('does not count template names when naming new documents', () => {
        const { store, originalId, templateId } = savedTemplate();

        store.actions.removeDocument(originalId);
        store.actions.newDocumentFromSavedTemplate({ templateId, id: 'from-template' });

        expect(store.state.documents['from-template'].name).toBe('Checkout');
    });

    it('never opens a template in place of a deleted current document', () => {
        const { store, originalId } = savedTemplate();

        store.actions.trashDocument(originalId);

        expect(store.state.documents[store.state.currentDocumentId].template).toBeUndefined();
    });

    it('keeps templates out of the libraries documents import components from', () => {
        const { store } = createTestStore();

        store.actions.addDocument({
            id: 'library',
            components: { card: createComponent({ id: 'card', name: 'Card' }) }
        });
        store.actions.saveAsTemplate('library');

        expect(componentLibraries(store.state).map(({ documentId }) => documentId)).toEqual([
            'library'
        ]);
    });

    it('keeps the template mark when saved and loaded again', () => {
        const { store, templateId } = savedTemplate();
        const saved = migratePersistedState(
            JSON.parse(JSON.stringify(serializePersistedState(store.state)))
        )!;

        expect(restoreDocuments(saved)[templateId].template).toBe(true);
    });
});
