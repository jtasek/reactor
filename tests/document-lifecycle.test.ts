import { describe, expect, it } from 'vitest';
import { DeleteCommand } from 'src/commands';
import { createApplication, createComponent } from 'src/app/factories';
import { createTestStore } from './support/store';
import { serializePersistedState } from 'src/app/services/documentStorage';

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

        store.actions.addShape({ type: 'rectangle', size: { width: 10, height: 20 } });

        expect(store.state.currentDocument.shapesIds).toHaveLength(1);
        expect(() => serializePersistedState(store.state)).not.toThrow();
    });

    it('preserves the active document when deleting another and switches when necessary', () => {
        const { store } = createTestStore();
        const originalId = store.state.currentDocumentId;

        store.actions.addDocument({ id: 'other' });
        store.actions.removeDocument('other');

        expect(store.state.currentDocumentId).toBe(originalId);

        store.actions.addDocument({ id: 'remaining' });
        store.actions.removeDocument(originalId);

        expect(store.state.documentsIds).toEqual(['remaining']);
        expect(store.state.currentDocument.id).toBe('remaining');
    });

    it('keeps all cloned tables independent while preserving document-scoped IDs', () => {
        const { store } = createTestStore();

        store.actions.addShape({ type: 'rectangle', size: { width: 30, height: 40 } });

        const originalId = store.state.currentDocumentId;
        const [shapeId] = store.state.currentDocument.shapesIds;

        store.actions.addGroup({ id: 'group', shapesIds: [shapeId] });
        store.actions.addLayer({ id: 'layer', shapesIds: [shapeId] });
        store.actions.addLink({ id: 'link', source: shapeId, target: shapeId });
        store.actions.addRuler({ id: 'ruler' });
        store.actions.updateDocument({
            id: originalId,
            tags: ['original'],
            components: { component: createComponent({ id: 'component', shapesIds: [shapeId] }) }
        });

        const before = serializePersistedState(store.state).documents[originalId];

        store.actions.cloneDocument(originalId);

        const copyId = store.state.documentsIds.find((id) => id !== originalId)!;

        store.actions.openDocument(copyId);

        expect(store.state.currentDocument.shapesIds).toEqual([shapeId]);
        expect(store.state.currentDocument.groups.group.shapesIds).toEqual([shapeId]);
        expect(store.state.currentDocument.links.link.source).toBe(shapeId);

        store.actions.tools.panCamera({ dx: 100, dy: 50 });
        store.actions.updateLink({ id: 'link', name: 'Changed link' });
        store.actions.updateRuler({ id: 'ruler', position: { x: 5, y: 10 } });
        store.actions.removeShape(shapeId);

        const copy = store.state.currentDocument;

        expect(copy.groups.group.shapesIds).toEqual([]);
        expect(copy.layers.layer.shapesIds).toEqual([]);
        expect(copy.components.component.shapesIds).toEqual([]);
        expect(copy.linksIds).toEqual([]);
        expect(serializePersistedState(store.state).documents[originalId]).toEqual(before);
    });

    it('cleans memberships, links, and parents through the delete command', () => {
        const { store } = createTestStore();

        store.actions.addShape({ type: 'rectangle', size: { width: 10, height: 20 } });
        store.actions.addShape({ type: 'rectangle', size: { width: 30, height: 40 } });

        const document = store.state.currentDocument;
        const [deletedId, remainingId] = document.shapesIds;

        store.actions.updateShape({ id: remainingId, parentShapeId: deletedId });
        store.actions.addGroup({ id: 'group', shapesIds: [deletedId, remainingId] });
        store.actions.addLayer({ id: 'layer', shapesIds: [deletedId, remainingId] });
        store.actions.addLink({ id: 'dangling', source: deletedId, target: remainingId });
        store.actions.addLink({ id: 'retained', source: remainingId, target: remainingId });
        store.actions.unselectShapes();
        store.actions.selectShape(deletedId);
        store.actions.executeCommand(DeleteCommand.execute);

        expect(document.shapesIds).toEqual([remainingId]);
        expect(document.selectedShapesIds).toEqual([]);
        expect(document.groups.group.shapesIds).toEqual([remainingId]);
        expect(document.layers.layer.shapesIds).toEqual([remainingId]);
        expect(document.linksIds).toEqual(['retained']);
        expect(document.shapes[remainingId].parentShapeId).toBeUndefined();
        expect(() => serializePersistedState(store.state)).not.toThrow();
    });

    it('preserves locked shapes and their references during deletion', () => {
        const { store } = createTestStore();

        store.actions.addShape({
            type: 'rectangle',
            size: { width: 10, height: 20 },
            locked: true
        });

        const document = store.state.currentDocument;
        const [shapeId] = document.shapesIds;

        store.actions.addGroup({ id: 'group', shapesIds: [shapeId] });
        store.actions.addLink({ id: 'link', source: shapeId });
        store.actions.executeCommand(DeleteCommand.execute);

        expect(document.shapesIds).toEqual([shapeId]);
        expect(document.groups.group.shapesIds).toEqual([shapeId]);
        expect(document.linksIds).toEqual(['link']);
    });
});
