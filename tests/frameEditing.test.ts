import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import {
    hydrateDocument,
    readEntity,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { FrameTool } from 'src/tools/components/Frame';
import { registerTool } from 'src/app/actions/startup';

const geometry = { position: { x: 100, y: 80 }, size: { width: 300, height: 200 } };
const add = (store: ReturnType<typeof createTestStore>['store']) =>
    store.actions.editFrame({ kind: 'add', ...geometry })!;

it('creates independently named frames, selects one without selecting its artwork, and edits validated fields', () => {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 120, y: 100 },
        size: { width: 40, height: 30 },
        selected: true
    });
    const first = add(store);
    const second = add(store);
    const document = store.state.currentDocument;
    expect(document.frames[first].name).toBe('Frame');
    expect(document.frames[second].name).toBe('Frame 2');
    expect(document.selectedFrameId).toBe(second);
    expect(document.selectedShapesIds).toEqual([]);
    store.actions.editFrame({
        kind: 'update',
        id: second,
        changes: { name: 'Home', size: { width: 390, height: 844 } }
    });
    expect(document.frames[second]).toMatchObject({
        name: 'Home',
        size: { width: 390, height: 844 }
    });
    store.actions.editFrame({
        kind: 'update',
        id: second,
        changes: { name: ' ', size: { width: 0, height: 100 } }
    });
    expect(document.frames[second]).toMatchObject({
        name: 'Home',
        size: { width: 390, height: 844 }
    });
    expect(document.shapes[document.shapesIds[0]]).toMatchObject({ position: { x: 120, y: 100 } });
});

it('commits a frame tool gesture synchronously and leaves no frame after cancel or a click', () => {
    const { store } = createTestStore();
    registerTool(FrameTool);
    const draw = () => {
        store.actions.tools.activateTool('frame');
        store.actions.events.beginGesture({ pointerId: 1, position: { x: 100, y: 80 } });
        store.actions.events.movePointer({ pointerId: 1, position: { x: 400, y: 280 } });
    };
    draw();
    store.actions.events.cancelGesture();
    expect(Object.keys(store.state.currentDocument.frames)).toHaveLength(0);
    draw();
    store.actions.events.endGesture({ pointerId: 1, position: { x: 400, y: 280 } });
    expect(Object.values(store.state.currentDocument.frames)).toMatchObject([geometry]);
    expect(store.state.events.pointer.gesture.kind).toBe('idle');
});

it('round trips frame boxes without saving selection and rejects invalid durable geometry', () => {
    const { store } = createTestStore();
    const id = add(store);
    const saved = serializePersistedState(store.state).documents[store.state.currentDocumentId];
    expect(saved).not.toHaveProperty('selectedFrameId');
    const restored = hydrateDocument(saved);
    expect(restored.frames[id]).toEqual(store.state.currentDocument.frames[id]);
    expect(restored.selectedFrameId).toBeUndefined();
    expect(() =>
        readEntity('frames', { ...restored.frames[id], position: { x: Infinity, y: 0 } })
    ).toThrow();
    expect(() =>
        readEntity('frames', { ...restored.frames[id], size: { width: -1, height: 1 } })
    ).toThrow();
});

it('copies, pastes and clones a frame with fresh identity and safe names, and cuts only after clipboard success', async () => {
    const { store, effects, systemClipboard } = createTestStore();
    const id = add(store);
    const text = store.actions.copySelection()!;
    expect(store.actions.pasteShapes(text)).toBe('pasted');
    const pasted = store.state.currentDocument.selectedFrameId!;
    expect(pasted).not.toBe(id);
    expect(store.state.currentDocument.frames[pasted].name).toBe('Frame 2');
    store.actions.editFrame({ kind: 'clone', id: pasted });
    expect(Object.keys(store.state.currentDocument.frames)).toHaveLength(3);
    const cut = store.actions.selectionToCut()!;
    const target = store.state.currentDocument.selectedFrameId!;
    const write = vi
        .spyOn(systemClipboard, 'writeText')
        .mockRejectedValueOnce(new Error('refused'));
    await effects.clipboard.cut(cut);
    expect(store.state.currentDocument.frames[target]).toBeDefined();
    write.mockRestore();
    await effects.clipboard.cut(cut);
    expect(store.state.currentDocument.frames[target]).toBeUndefined();
    expect(store.actions.pasteShapes(text.replace('"width":300', '"width":-1'))).toBe('noShapes');
});

it('validates a frame operation batch atomically and undoes accepted operations', async () => {
    const [copy] = await createCopies(1);
    const { store } = copy;
    const id = add(store);
    copy.collaboration.flush();
    const result = store.actions.applyOperations({
        documentId: DOCUMENT_ID,
        by: { kind: 'person' },
        operations: [
            { op: 'updateFrame', frame: id, changes: { name: 'Changed' } },
            {
                op: 'addFrame',
                key: 'invalid',
                frame: {
                    name: 'Invalid',
                    ...geometry,
                    size: { width: 0, height: 20 },
                    locked: false,
                    visible: true
                }
            }
        ]
    });
    expect(result.applied).toBe(false);
    expect(shownDocument(copy).frames[id].name).toBe('Frame');
    const accepted = store.actions.applyOperations({
        documentId: DOCUMENT_ID,
        by: { kind: 'person' },
        operations: [{ op: 'updateFrame', frame: id, changes: { name: 'Home' } }]
    });
    expect(accepted.applied).toBe(true);
    copy.collaboration.undo(DOCUMENT_ID);
    expect(shownDocument(copy).frames[id].name).toBe('Frame');
});

it('merges independent box fields and undoes only this copy’s edit', async () => {
    const copies = await createCopies(2, (store) => {
        add(store);
    });
    const [a, b] = copies;
    const id = Object.keys(shownDocument(a).frames)[0];
    edit(a, (actions) =>
        actions.editFrame({ kind: 'update', id, changes: { position: { x: 130, y: 80 } } })
    );
    edit(b, (actions) =>
        actions.editFrame({ kind: 'update', id, changes: { size: { width: 400, height: 200 } } })
    );
    settle(copies);
    expect(shownDocument(a).frames[id]).toEqual(shownDocument(b).frames[id]);
    expect(shownDocument(a).frames[id]).toMatchObject({
        position: { x: 130, y: 80 },
        size: { width: 400, height: 200 }
    });
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).frames[id]).toMatchObject({
        position: { x: 100, y: 80 },
        size: { width: 400, height: 200 }
    });
});

it('rebases a canceled drag over remote edits and never resurrects a remotely deleted frame', async () => {
    const copies = await createCopies(2, (store) => {
        add(store);
    });
    const [a, b] = copies;
    const id = Object.keys(shownDocument(a).frames)[0];
    const begin = () =>
        a.store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 100, y: 80 },
            handle: { frameId: id, type: 'move' }
        });
    begin();
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 150, y: 90 } });
    edit(b, (actions) =>
        actions.editFrame({
            kind: 'update',
            id,
            changes: { name: 'Remote', position: { x: 200, y: 80 } }
        })
    );
    settle(copies);
    a.store.actions.events.cancelGesture();
    settle(copies);
    expect(shownDocument(a).frames[id]).toEqual(shownDocument(b).frames[id]);
    expect(shownDocument(a).frames[id]).toMatchObject({
        name: 'Remote',
        position: { x: 200, y: 80 }
    });
    begin();
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 250, y: 100 } });
    edit(b, (actions) => actions.editFrame({ kind: 'delete', id }));
    settle(copies);
    a.store.actions.events.cancelGesture();
    settle(copies);
    expect(shownDocument(a).frames[id]).toBeUndefined();
    expect(shownDocument(a).selectedFrameId).toBeUndefined();
});

it('keeps a frame drag to its owning pointer, honors click slip and makes resize cancelable', () => {
    const { store } = createTestStore();
    const id = add(store);
    const frame = () => store.state.currentDocument.frames[id];
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 400, y: 280 },
        handle: { frameId: id, type: 'bottomRight' }
    });
    store.actions.events.movePointer({ pointerId: 2, position: { x: 500, y: 400 } });
    expect(frame().size).toEqual(geometry.size);
    store.actions.events.movePointer({ pointerId: 1, position: { x: 401, y: 281 } });
    expect(frame().size).toEqual(geometry.size);
    store.actions.events.movePointer({ pointerId: 1, position: { x: 500, y: 400 } });
    expect(frame().size).toEqual({ width: 400, height: 320 });
    store.actions.events.cancelGesture();
    expect(frame().size).toEqual(geometry.size);
});

it('prevents edits to locked and read-only documents', () => {
    const { store } = createTestStore();
    const id = add(store);
    store.actions.lockDocument(store.state.currentDocumentId);
    store.actions.editFrame({ kind: 'update', id, changes: { name: 'No' } });
    store.actions.editFrame({ kind: 'delete', id });
    expect(store.state.currentDocument.frames[id].name).toBe('Frame');
    store.actions.unlockDocument(store.state.currentDocumentId);
    store.actions.setDocumentAccess({ [store.state.currentDocumentId]: { role: 'viewer' } });
    expect(add(store)).toBeUndefined();
    store.actions.editFrame({ kind: 'update', id, changes: { name: 'No' } });
    expect(store.state.currentDocument.frames[id].name).toBe('Frame');
});

it('deletes frames through operations without deleting artwork and restores the frame with shared undo', async () => {
    const copies = await createCopies(2, (store) => {
        add(store);
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 120, y: 100 },
            size: { width: 40, height: 30 }
        });
    });
    const [a, b] = copies;
    const id = Object.keys(shownDocument(a).frames)[0];
    const shapeId = shownDocument(a).shapesIds[0];
    expect(
        a.store.actions.applyOperations({
            documentId: DOCUMENT_ID,
            by: { kind: 'person' },
            operations: [{ op: 'deleteFrame', frame: id }]
        }).applied
    ).toBe(true);
    settle(copies);
    expect(shownDocument(b).frames[id]).toBeUndefined();
    expect(shownDocument(b).shapes[shapeId]).toBeDefined();
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).frames[id]).toMatchObject(geometry);
});

it('keeps frame creation out of component-source editing and leaves that context when selecting a frame', () => {
    const { store } = createTestStore();
    const id = add(store);
    store.actions.addComponent({ id: 'source', shapesIds: [] });
    store.actions.editComponentSource('source');
    expect(store.state.currentDocument.editingComponentId).toBe('source');
    expect(add(store)).toBeUndefined();
    store.actions.editFrame({ kind: 'select', id });
    expect(store.state.currentDocument.editingComponentId).toBeNull();
    expect(store.state.currentDocument.selectedFrameId).toBe(id);
});

it('restores the previous selection when a frame drag or a marquee is canceled', () => {
    const { store } = createTestStore();
    const id = add(store);
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 500, y: 500 },
        size: { width: 20, height: 20 },
        selected: true
    });
    store.actions.unselectShapes();
    const shapeId = store.state.currentDocument.shapesIds[0];
    store.actions.selectShape(shapeId);
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 100, y: 80 },
        handle: { frameId: id, type: 'move' }
    });
    store.actions.events.movePointer({ pointerId: 1, position: { x: 130, y: 100 } });
    store.actions.events.cancelGesture();
    expect(store.state.currentDocument.selectedFrameId).toBeUndefined();
    expect(store.state.currentDocument.selectedShapesIds).toEqual([shapeId]);
    store.actions.editFrame({ kind: 'select', id });
    store.actions.events.beginGesture({ pointerId: 1, position: { x: 700, y: 700 } });
    store.actions.events.movePointer({ pointerId: 1, position: { x: 900, y: 900 } });
    store.actions.events.cancelGesture();
    expect(store.state.currentDocument.selectedFrameId).toBe(id);
    expect(store.state.currentDocument.selectedShapesIds).toEqual([]);
});
