import { frameState, isFrameVisible, isFrameLocked, projectFrameStates } from 'src/app/frameState';
import { shownShapesIds } from 'src/app/membership';
import { isShapeVisible, isShapeLocked } from 'src/app/utils';
import { DeleteCommand } from 'src/commands/delete';
import { CloneCommand } from 'src/commands/clone';
import { CutCommand } from 'src/commands/clipboard';
import { json } from 'overmind';
import { createTestStore } from './support/store';
import {
    createCopies,
    edit,
    settle,
    shownDocument,
    sharedState,
    DOCUMENT_ID
} from './support/collaboration';
import { frameParents, frameContents } from 'src/app/frameMembership';
import {
    hydrateDocument,
    serializePersistedState,
    migratePersistedState,
    readEntity
} from 'src/app/services/documentStorage';
import { writeClipboard, readClipboard } from 'src/app/frameEdits';

type Store = ReturnType<typeof createTestStore>['store'];
const addFrame = (store: Store, name: string) => {
    const id = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 80 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({ kind: 'update', id, changes: { name } });

    return id;
};
const addShape = (store: Store, parentFrameId?: string) => {
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 120, y: 100 },
        size: { width: 40, height: 30 },
        parentFrameId
    });

    return store.state.currentDocument.shapesIds.at(-1)!;
};
const setup = (store: Store) => {
    const root = addFrame(store, 'Screen');
    const child = addFrame(store, 'Card');
    store.actions.editFrame({ kind: 'update', id: child, changes: { parentFrameId: root } });
    const shape = addShape(store, child);

    return { root, child, shape };
};

it('reparents without moving geometry, saves memberships and loads version 6 documents', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const document = store.state.currentDocument;
    const position = json(document.shapes[shape]);
    store.actions.editFrame({ kind: 'reparentShapes', ids: [shape], parentFrameId: root });
    expect(document.shapes[shape]).toMatchObject({ ...position, parentFrameId: root });
    store.actions.editFrame({ kind: 'reparentShapes', ids: [shape], parentFrameId: null });
    expect(document.shapes[shape]).not.toHaveProperty('parentFrameId');
    const saved = serializePersistedState(store.state);
    const restored = hydrateDocument(saved.documents[document.id]);
    expect(restored.frames[child].parentFrameId).toBe(root);
    expect(
        migratePersistedState({ ...saved, version: 6 })?.documents[document.id].frames[child]
            .parentFrameId
    ).toBe(root);
    expect(() =>
        readEntity('frames', { ...json(document.frames[child]), parentFrameId: 12 })
    ).toThrow();
});

it('rejects invalid parents and a batch-created cycle atomically, including references to deleted frames', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const document = store.state.currentDocument;
    const before = json(document.frames);
    store.actions.editFrame({ kind: 'update', id: root, changes: { parentFrameId: child } });
    store.actions.editFrame({ kind: 'reparentShapes', ids: [shape], parentFrameId: 'missing' });
    expect(document.frames).toEqual(before);
    expect(document.shapes[shape].parentFrameId).toBe(child);
    const result = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            { op: 'updateFrame', frame: child, changes: { parentFrameId: root } },
            { op: 'updateFrame', frame: root, changes: { parentFrameId: child } }
        ]
    });
    expect(result.applied).toBe(false);
    expect(document.frames).toEqual(before);
    expect(
        store.actions.checkOperations({
            documentId: document.id,
            operations: [
                { op: 'deleteFrame', frame: root },
                { op: 'updateShape', shape, changes: { parentFrameId: root } }
            ]
        }).valid
    ).toBe(false);
});

it('resolves earlier frame keys for shape and frame parents and clears a shape parent explicitly', () => {
    const { store } = createTestStore();
    const document = store.state.currentDocument;
    const box = {
        name: 'Screen',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 },
        locked: false,
        visible: true
    };
    const result = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            { op: 'addFrame', key: 'root', frame: box },
            {
                op: 'addFrame',
                key: 'child',
                frame: { ...box, name: 'Card', parentFrameId: 'root' }
            },
            {
                op: 'addShape',
                key: 'shape',
                shape: {
                    type: 'rectangle',
                    position: { x: 30, y: 40 },
                    size: { width: 20, height: 20 },
                    parentFrameId: 'child'
                }
            }
        ]
    });
    expect(result.applied).toBe(true);
    if (!result.applied) {
        throw new Error(result.problem);
    }
    expect(document.frames[result.ids.child].parentFrameId).toBe(result.ids.root);
    expect(document.shapes[result.ids.shape].parentFrameId).toBe(result.ids.child);
    store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            { op: 'updateShape', shape: result.ids.shape, changes: { parentFrameId: null } }
        ]
    });
    expect(document.shapes[result.ids.shape]).not.toHaveProperty('parentFrameId');
});

it('moves a nested subtree once, resizes only its boundary and keeps positions when deleting its parent', async () => {
    const [copy] = await createCopies(1);
    const { store } = copy;
    const { root, child, shape } = setup(store);
    copy.collaboration.flush();
    const document = store.state.currentDocument;
    edit(copy, (actions) =>
        actions.editFrame({ kind: 'update', id: root, changes: { position: { x: 140, y: 100 } } })
    );
    expect(document.frames[child].position).toEqual({ x: 140, y: 100 });
    expect(document.shapes[shape]).toMatchObject({ position: { x: 160, y: 120 } });
    copy.collaboration.undo(DOCUMENT_ID);
    expect(document.frames[child].position).toEqual({ x: 100, y: 80 });
    expect(document.shapes[shape]).toMatchObject({ position: { x: 120, y: 100 } });
    edit(copy, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: root,
            changes: { size: { width: 400, height: 250 } }
        })
    );
    expect(document.shapes[shape]).toMatchObject({ position: { x: 120, y: 100 } });
    edit(copy, (actions) => actions.editFrame({ kind: 'delete', id: root }));
    expect(document.frames[child]).not.toHaveProperty('parentFrameId');
    expect(document.shapes[shape].parentFrameId).toBe(child);
    copy.collaboration.undo(DOCUMENT_ID);
    expect(document.frames[child].parentFrameId).toBe(root);
});

it('moves descendants through operation batches and refuses locked descendants or overlapping edits', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const document = store.state.currentDocument;
    const move = {
        op: 'updateFrame' as const,
        frame: root,
        changes: { position: { x: 150, y: 80 } }
    };
    const batch = { documentId: document.id, by: { kind: 'person' as const }, operations: [move] };
    const moved = store.actions.applyOperations(batch);
    expect(moved, JSON.stringify(moved)).toMatchObject({ applied: true });
    expect(document.shapes[shape]).toMatchObject({ position: { x: 170, y: 100 } });
    store.actions.editFrame({ kind: 'toggle', id: child, flag: 'locked' });
    expect(
        store.actions.applyOperations({
            ...batch,
            operations: [{ ...move, changes: { position: { x: 200, y: 80 } } }]
        }).applied
    ).toBe(false);
    store.actions.editFrame({ kind: 'toggle', id: child, flag: 'locked' });
    expect(
        store.actions.applyOperations({
            ...batch,
            operations: [move, { op: 'updateShape', shape, changes: { name: 'Changed' } }]
        }).applied
    ).toBe(true); // zero displacement does not touch descendants
    expect(
        store.actions.applyOperations({
            ...batch,
            operations: [
                { ...move, changes: { position: { x: 200, y: 80 } } },
                { op: 'updateShape', shape, changes: { name: 'Changed' } }
            ]
        }).applied
    ).toBe(false);
});

it('reparents a complete group, keeps grouping in one frame and preserves membership when cloning a shape', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const second = addShape(store);
    store.actions.unselectShapes();
    store.actions.selectShape(shape);
    store.actions.selectShape(second);
    store.actions.groupSelection();
    expect(store.state.currentDocument.shapes[shape]).not.toHaveProperty('parentFrameId');
    store.actions.editFrame({ kind: 'reparentShapes', ids: [second], parentFrameId: root });
    expect(store.state.currentDocument.shapes[shape].parentFrameId).toBe(root);
    expect(store.state.currentDocument.shapes[second].parentFrameId).toBe(root);
    expect(
        store.actions.applyOperations({
            documentId: store.state.currentDocumentId,
            by: { kind: 'person' },
            operations: [{ op: 'updateShape', shape, changes: { parentFrameId: child } }]
        }).applied
    ).toBe(false);
    store.actions.cloneShapes([second]);
    expect(
        store.state.currentDocument.shapes[store.state.currentDocument.shapesIds.at(-1)!]
            .parentFrameId
    ).toBe(root);
});

it('copies a complete subtree across documents with new identities and remapped memberships', () => {
    const { store } = createTestStore();
    const { root } = setup(store);
    store.actions.editFrame({ kind: 'select', id: root });
    const text = store.actions.copySelection()!;
    const target = createTestStore().store;
    expect(target.actions.pasteShapes(text)).toBe('pasted');
    const document = target.state.currentDocument;
    const pastedRoot = document.selectedFrameId!;
    const contents = frameContents(document, pastedRoot);
    expect(contents.frames).toHaveLength(1);
    expect(contents.shapes).toHaveLength(1);
    expect(document.frames[contents.frames[0]].parentFrameId).toBe(pastedRoot);
    expect(document.shapes[contents.shapes[0]].parentFrameId).toBe(contents.frames[0]);
    expect(document.shapes[contents.shapes[0]]).toMatchObject({ position: { x: 130, y: 110 } });
    expect(pastedRoot).not.toBe(root);
    expect(target.actions.pasteShapes(text)).toBe('pasted');
    expect(
        Object.values(document.frames)
            .map((frame) => frame.name)
            .sort()
    ).toEqual(['Card', 'Card 2', 'Screen', 'Screen 2']);
});

it('rejects malformed subtree payloads instead of dropping their artwork or accepting cyclic parents', () => {
    const { store } = createTestStore();
    const { root } = setup(store);
    const data = JSON.parse(
        writeClipboard(store.state.currentDocument.frames[root], store.state.currentDocument)
    );
    expect(
        readClipboard(
            JSON.stringify({
                ...data,
                children: [{ ...data.children[0], parentFrameId: data.children[0].id }]
            })
        )
    ).toBeUndefined();
    expect(
        readClipboard(
            JSON.stringify({ ...data, members: [{ ...data.members[0], parentFrameId: 'missing' }] })
        )
    ).toBeUndefined();
    expect(readClipboard(JSON.stringify({ ...data, artwork: 'broken' }))).toBeUndefined();
});

it('cuts only captured subtree records and leaves newly attached children in place', async () => {
    const { store, effects, systemClipboard } = createTestStore();
    const { root, child, shape } = setup(store);
    store.actions.editFrame({ kind: 'select', id: root });
    const cut = store.actions.selectionToCut()!;
    const newShape = addShape(store, root);
    const write = vi.spyOn(systemClipboard, 'writeText').mockResolvedValue();
    await effects.clipboard.cut(cut);
    const document = store.state.currentDocument;
    expect(document.frames[root]).toBeUndefined();
    expect(document.frames[child]).toBeUndefined();
    expect(document.shapes[shape]).toBeUndefined();
    expect(document.shapes[newShape]).toBeDefined();
    expect(document.shapes[newShape]).not.toHaveProperty('parentFrameId');
    write.mockRestore();
});

it('converges after deleting a parent while another production copy adds and reparents children, without repair feedback', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const root = Object.values(shownDocument(a).frames).find(
        (frame) => frame.name === 'Screen'
    )!.id;
    const child = Object.values(shownDocument(a).frames).find((frame) => frame.name === 'Card')!.id;
    edit(a, (actions) => actions.editFrame({ kind: 'delete', id: root }));
    let added = '';
    edit(b, () => {
        added = addShape(b.store, root);
    });
    settle(copies);
    for (const copy of copies) {
        expect(shownDocument(copy).frames[child]).not.toHaveProperty('parentFrameId');
        expect(shownDocument(copy).shapes[added]).not.toHaveProperty('parentFrameId');
        expect(shownDocument(copy).shapes[added]).toMatchObject({ position: { x: 120, y: 100 } });
        // Dangling-reference recovery affects the view, never the authored CRDT edge.
        expect(sharedState(copy).shapes[added].parentFrameId).toBe(root);
    }
    expect(json(shownDocument(a).frames)).toEqual(json(shownDocument(b).frames));
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).shapes[added].parentFrameId).toBe(root);
});

it('projects concurrent cycles as roots consistently without writing them back, and lets a person repair them', async () => {
    const copies = await createCopies(2, (store) => {
        addFrame(store, 'A');
        addFrame(store, 'B');
    });
    const [a, b] = copies;
    const [first, second] = Object.keys(shownDocument(a).frames);
    edit(a, (actions) =>
        actions.editFrame({ kind: 'update', id: first, changes: { parentFrameId: second } })
    );
    edit(b, (actions) =>
        actions.editFrame({ kind: 'update', id: second, changes: { parentFrameId: first } })
    );
    settle(copies);
    for (const copy of copies) {
        const parents = frameParents(shownDocument(copy).frames);
        expect(parents.get(first)).toBeUndefined();
        expect(parents.get(second)).toBeUndefined();
        expect(sharedState(copy).frames[first].parentFrameId).toBe(second);
        expect(sharedState(copy).frames[second].parentFrameId).toBe(first);
    }
    edit(a, (actions) =>
        actions.editFrame({ kind: 'update', id: first, changes: { parentFrameId: null } })
    );
    settle(copies);
    expect(frameParents(shownDocument(b).frames).get(second)).toBe(first);
});

it('restores descendant geometry on a canceled gesture while preserving remote edits', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const document = shownDocument(a);
    const root = Object.values(document.frames).find((frame) => frame.name === 'Screen')!.id;
    const child = Object.values(document.frames).find((frame) => frame.name === 'Card')!.id;
    const shape = document.shapesIds[0];
    a.store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 100, y: 80 },
        handle: { frameId: root, type: 'move' }
    });
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 150, y: 100 } });
    expect(document.shapes[shape]).toMatchObject({ position: { x: 170, y: 120 } });
    edit(b, (actions) =>
        actions.editFrame({ kind: 'update', id: child, changes: { name: 'Remote card' } })
    );
    settle(copies);
    a.store.actions.events.cancelGesture();
    settle(copies);
    expect(document.frames[child]).toMatchObject({
        name: 'Remote card',
        position: { x: 100, y: 80 }
    });
    expect(document.shapes[shape]).toMatchObject({ position: { x: 120, y: 100 } });
});

it('handles a deep frame chain without recursion and removes all edges of a cycle only in the view', () => {
    const { store } = createTestStore();
    const template = store.state.currentDocument.frames[addFrame(store, 'Template')];
    const frames = Object.fromEntries(
        Array.from({ length: 2000 }, (_, index) => [
            String(index),
            {
                ...json(template),
                id: String(index),
                ...(index > 0 ? { parentFrameId: String(index - 1) } : {})
            }
        ])
    );
    expect(frameContents({ frames, shapes: {} }, '0').frames).toHaveLength(1999);
    frames['0'].parentFrameId = '1';
    const parents = frameParents(frames);
    expect(parents.get('0')).toBeUndefined();
    expect(parents.get('1')).toBeUndefined();
    expect(parents.get('2')).toBe('1');
});

it('keeps color bindings and complete groups when copying a frame, and drops coordinate bindings when translating it', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const second = addShape(store, child);
    store.actions.createVariable({ name: 'Brand', type: 'color', value: '#123456' });
    const color = store.state.currentDocument.variablesIds[0];
    store.actions.bindProperty({ shapeIds: [shape], key: 'fill', variableId: color });
    store.actions.createVariable({ name: 'Left', type: 'number', value: 120 });
    const left = store.state.currentDocument.variablesIds.find(
        (id) => store.state.currentDocument.variables[id].name === 'Left'
    )!;
    store.actions.bindProperty({ shapeIds: [shape], key: 'x', variableId: left });
    store.actions.unselectShapes();
    store.actions.selectShape(shape);
    store.actions.selectShape(second);
    store.actions.groupSelection();
    store.actions.editFrame({ kind: 'select', id: root });
    const text = store.actions.copySelection()!;
    const target = createTestStore().store;
    expect(target.actions.pasteShapes(text)).toBe('pasted');
    const document = target.state.currentDocument;
    expect(Object.values(document.groups)).toHaveLength(1);
    const bound = Object.values(document.shapes).find((item) => item.bindings?.fill)!;
    expect(bound.fill).toBe('#123456');
    expect(document.variables[bound.bindings!.fill].name).toBe('Brand');
    expect(bound.bindings).not.toHaveProperty('x');
    expect(bound).toMatchObject({ position: { x: 130, y: 110 } });
});

it('repairs missing frame references on reload without changing any geometry', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const saved = serializePersistedState(store.state);
    delete saved.documents[store.state.currentDocumentId].frames[root];
    delete saved.documents[store.state.currentDocumentId].frames[child];
    const repaired = migratePersistedState(saved)!;
    expect(repaired.documents[store.state.currentDocumentId].shapes[shape]).not.toHaveProperty(
        'parentFrameId'
    );
    expect(repaired.documents[store.state.currentDocumentId].shapes[shape]).toMatchObject({
        position: { x: 120, y: 100 }
    });
});

it('keeps membership on a component instance while its source leaves the frame', () => {
    const { store } = createTestStore();
    const { child, shape } = setup(store);
    store.actions.unselectShapes();
    store.actions.selectShape(shape);
    store.actions.createComponentFromSelection();
    const document = store.state.currentDocument;
    const instance = Object.values(document.shapes).find((item) => item.type === 'instance')!;
    expect(instance.parentFrameId).toBe(child);
    expect(document.shapes[shape]).not.toHaveProperty('parentFrameId');
});

it('cancels a subtree drag safely when another copy deletes or reparents a member', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const document = shownDocument(a);
    const root = Object.values(document.frames).find((frame) => frame.name === 'Screen')!.id;
    const child = Object.values(document.frames).find((frame) => frame.name === 'Card')!.id;
    a.store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 100, y: 80 },
        handle: { frameId: root, type: 'move' }
    });
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 160, y: 120 } });
    edit(b, (actions) =>
        actions.editFrame({ kind: 'update', id: child, changes: { parentFrameId: null } })
    );
    settle(copies);
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 170, y: 130 } });
    settle(copies);
    expect(a.store.state.events.pointer.gesture.kind).toBe('idle');
    expect(document.frames[child]).not.toHaveProperty('parentFrameId');
    expect(document.frames[child].position).toEqual({ x: 100, y: 80 });
    expect(document.frames[root].position).toEqual({ x: 100, y: 80 });
    expect(json(document.frames)).toEqual(json(shownDocument(b).frames));
});

it('preserves hidden and locked subtree artwork when cloning a frame', () => {
    const { store } = createTestStore();
    const { root, shape } = setup(store);
    store.actions.toggleShapeVisible(shape);
    store.actions.toggleShapeLocked(shape);
    store.actions.editFrame({ kind: 'clone', id: root });
    const document = store.state.currentDocument;
    const contents = frameContents(document, document.selectedFrameId!);
    expect(contents.shapes).toHaveLength(1);
    expect(document.shapes[contents.shapes[0]]).toMatchObject({ locked: true, visible: false });
});

it('cancels a subtree move when another copy locks a child, keeping the remote lock on both copies', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const document = shownDocument(a);
    const root = Object.values(document.frames).find((frame) => frame.name === 'Screen')!.id;
    const shape = document.shapesIds[0];
    a.store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 100, y: 80 },
        handle: { frameId: root, type: 'move' }
    });
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 160, y: 120 } });
    edit(b, (actions) => actions.toggleShapeLocked(shape));
    settle(copies);
    a.store.actions.events.endGesture({ pointerId: 1, position: { x: 170, y: 130 } });
    settle(copies);
    expect(document.frames[root].position).toEqual({ x: 100, y: 80 });
    expect(document.shapes[shape]).toMatchObject({ locked: true, position: { x: 120, y: 100 } });
    expect(readEntity('shapes', document.shapes[shape])).toEqual(
        readEntity('shapes', shownDocument(b).shapes[shape])
    );
});

it('keeps a cloned nested frame in its parent and a cloned root frame on Canvas', () => {
    const { store } = createTestStore();
    const { root, child } = setup(store);
    store.actions.editFrame({ kind: 'clone', id: child });
    const document = store.state.currentDocument;
    const clone = document.selectedFrameId!;
    expect(clone).not.toBe(child);
    expect(document.frames[clone].parentFrameId).toBe(root);
    expect(frameContents(document, root).frames).toEqual(expect.arrayContaining([child, clone]));

    store.actions.editFrame({ kind: 'clone', id: root });
    expect(
        store.state.currentDocument.frames[store.state.currentDocument.selectedFrameId!]
    ).not.toHaveProperty('parentFrameId');
});

it('inherits frame visibility without rewriting descendant flags, including after save and reload', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const document = store.state.currentDocument;
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'visible' });
    expect(isFrameVisible(document, child)).toBe(false);
    expect(isShapeVisible(document, shape)).toBe(false);
    expect(shownShapesIds(document, null)).not.toContain(shape);
    expect(document.frames[child].visible).toBe(true);
    expect(document.shapes[shape].visible).toBe(true);
    const saved = serializePersistedState(store.state);
    expect(saved.documents[document.id]).not.toHaveProperty('frameStates');
    const restored = hydrateDocument(saved.documents[document.id]);
    expect(frameState(restored, child)?.hiddenBy).toBe(root);
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'visible' });
    expect(shownShapesIds(document, null)).toContain(shape);
    store.actions.toggleShapeVisible(shape);
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'visible' });
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'visible' });
    expect(isShapeVisible(document, shape)).toBe(false);
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'visible' });
    store.actions.showAll();
    expect(isFrameVisible(document, child)).toBe(true);
    expect(isShapeVisible(document, shape)).toBe(true);
});

it('blocks descendant edits, flag changes and reparenting under a locked frame, and permits recovery', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const document = store.state.currentDocument;
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'locked' });
    expect(isFrameLocked(document, child)).toBe(true);
    expect(isShapeLocked(document, shape)).toBe(true);
    const before = json(document.shapes[shape]);
    store.actions.updateShape({ id: shape, name: 'Changed' });
    store.actions.setShapesProperty({
        shapeIds: [shape],
        key: 'name',
        value: 'Changed in Inspector'
    });
    store.actions.setShapesProperty({ shapeIds: [shape], key: 'visible', value: false });
    store.actions.toggleShapeVisible(shape);
    store.actions.toggleShapeLocked(shape);
    store.actions.unlockShape(shape);
    store.actions.editFrame({ kind: 'update', id: child, changes: { name: 'Changed' } });
    store.actions.editFrame({ kind: 'reparentShapes', ids: [shape], parentFrameId: null });
    store.actions.editFrame({ kind: 'toggle', id: child, flag: 'locked' });
    expect(document.shapes[shape]).toEqual(before);
    expect(document.frames[child]).toMatchObject({ name: 'Card', locked: false });
    store.actions.editFrame({ kind: 'select', id: child });
    const context = { state: store.state };
    expect(DeleteCommand.canExecute(context)).toBe(false);
    expect(CloneCommand.canExecute(context)).toBe(false);
    expect(CutCommand.canExecute(context)).toBe(false);
    expect(store.actions.selectionToCut()).toBeNull();
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'locked' });
    expect(isShapeLocked(document, shape)).toBe(false);
    store.actions.updateShape({ id: shape, name: 'Changed' });
    expect(document.shapes[shape].name).toBe('Changed');
});

it('rejects operation edits and insertions into an existing locked frame atomically', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const document = store.state.currentDocument;
    const outsider = addShape(store);
    const sentinel = addShape(store);
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'locked' });
    const operations = [
        { op: 'updateShape' as const, shape, changes: { name: 'Changed' } },
        { op: 'deleteShapes' as const, shapes: [shape] },
        { op: 'updateFrame' as const, frame: child, changes: { parentFrameId: null } },
        { op: 'deleteFrame' as const, frame: child },
        { op: 'updateShape' as const, shape: outsider, changes: { parentFrameId: child } },
        {
            op: 'addFrame' as const,
            key: 'nested',
            frame: { ...json(document.frames[child]), parentFrameId: child }
        },
        {
            op: 'addShape' as const,
            key: 'nestedShape',
            shape: { ...json(document.shapes[shape]), parentFrameId: child }
        }
    ];
    const before = serializePersistedState(store.state);

    for (const operation of operations) {
        const result = store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [
                { op: 'updateShape', shape: sentinel, changes: { name: 'Other edit' } },
                operation
            ]
        });
        expect(result.applied, JSON.stringify(operation)).toBe(false);
    }

    expect(serializePersistedState(store.state)).toEqual(before);
});

it('keeps cycle members as independent roots and inherits only valid parent edges', () => {
    const { store } = createTestStore();
    const { root, child } = setup(store);
    const frames = json(store.state.currentDocument.frames);
    frames[root].parentFrameId = child;
    frames[root].visible = false;
    frames[root].locked = true;
    frames.descendant = { ...frames[child], id: 'descendant', parentFrameId: root };
    frames.orphan = { ...frames[child], id: 'orphan', parentFrameId: 'missing' };
    const states = projectFrameStates(frames);
    expect(states[root]).toEqual({ hiddenBy: root, lockedBy: root });
    expect(states[child]).toEqual({ hiddenBy: undefined, lockedBy: undefined });
    expect(states.descendant).toEqual(states[root]);
    expect(states.orphan).toEqual(states[child]);
});

it('resolves deep hierarchies iteratively without reading geometry', () => {
    const { store } = createTestStore();
    const { child } = setup(store);
    const frames = Object.fromEntries(
        Array.from({ length: 2000 }, (_, index) => [
            String(index),
            {
                ...json(store.state.currentDocument.frames[child]),
                id: String(index),
                parentFrameId: index === 0 ? undefined : String(index - 1),
                locked: index === 0,
                get position(): never {
                    throw new Error('Geometry must not be read');
                },
                get size(): never {
                    throw new Error('Geometry must not be read');
                }
            }
        ])
    );
    expect(projectFrameStates(frames)['1999'].lockedBy).toBe('0');
});

it.each(['visible', 'locked'] as const)(
    'rolls back a subtree drag after a remote ancestor %s change, retaining the remote flag',
    async (flag) => {
        const copies = await createCopies(2, (store) => setup(store));
        const [a, b] = copies;
        const document = shownDocument(a);
        const root = Object.values(document.frames).find((frame) => frame.name === 'Screen')!.id;
        const child = Object.values(document.frames).find((frame) => frame.name === 'Card')!.id;
        a.store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 100, y: 80 },
            handle: { frameId: child, type: 'move' }
        });
        a.store.actions.events.movePointer({ pointerId: 1, position: { x: 160, y: 120 } });
        edit(b, (actions) => actions.editFrame({ kind: 'toggle', id: root, flag }));
        settle(copies);
        a.store.actions.events.endGesture({ pointerId: 1, position: { x: 170, y: 130 } });
        settle(copies);
        expect(a.store.state.events.pointer.gesture.kind).toBe('idle');
        expect(document.frames[child].position).toEqual({ x: 100, y: 80 });
        expect(document.shapes[document.shapesIds[0]]).toMatchObject({
            position: { x: 120, y: 100 }
        });
        expect(document.frames[root][flag]).toBe(flag === 'locked');
        expect(sharedState(a)).toEqual(sharedState(b));
        b.collaboration.undo(DOCUMENT_ID);
        settle(copies);
        expect(document.frames[root][flag]).toBe(flag === 'visible');
        expect(isShapeLocked(document, document.shapesIds[0])).toBe(false);
        expect(isShapeVisible(document, document.shapesIds[0])).toBe(true);
    }
);

it.each(['visible', 'locked'] as const)(
    'rolls back a shape drag after a remote ancestor %s change',
    async (flag) => {
        const copies = await createCopies(2, (store) => setup(store));
        const [a, b] = copies;
        const document = shownDocument(a);
        const root = Object.values(document.frames).find((frame) => frame.name === 'Screen')!.id;
        const shape = document.shapesIds[0];
        a.store.actions.events.beginGesture({ pointerId: 1, position: { x: 130, y: 110 } });
        a.store.actions.events.movePointer({ pointerId: 1, position: { x: 160, y: 140 } });
        expect(document.shapes[shape]).not.toMatchObject({ position: { x: 120, y: 100 } });
        edit(b, (actions) => actions.editFrame({ kind: 'toggle', id: root, flag }));
        settle(copies);
        a.store.actions.events.endGesture({ pointerId: 1, position: { x: 170, y: 150 } });
        settle(copies);
        expect(a.store.state.events.pointer.gesture.kind).toBe('idle');
        expect(document.shapes[shape]).toMatchObject({ position: { x: 120, y: 100 } });
        expect(document.frames[root][flag]).toBe(flag === 'locked');
        expect(sharedState(a)).toEqual(sharedState(b));
    }
);

it('protects framed group flags, membership and clones while allowing copies', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const second = addShape(store, child);
    store.actions.selectShape(shape);
    store.actions.selectShape(second);
    store.actions.groupSelection();
    const document = store.state.currentDocument;
    const group = document.groups[document.groupsIds[0]];
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'locked' });
    const before = json(group);
    store.actions.toggleGroupVisible(group.id);
    store.actions.toggleGroupLocked(group.id);
    store.actions.updateGroup({ id: group.id, name: 'Changed' });
    store.actions.hideSelection();
    store.actions.lockSelection();
    store.actions.ungroupSelection();
    expect(document.groups[group.id]).toEqual(before);
    const count = document.shapesIds.length;
    store.actions.cloneShapes([shape, second]);
    expect(document.shapesIds).toHaveLength(count);
    store.actions.selectShape(shape);
    expect(store.actions.copySelection()).not.toBeNull();
    expect(
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [{ op: 'deleteGroup', group: group.id }]
        }).applied
    ).toBe(false);
});

it('rejects grouping existing artwork inside a locked frame through operations', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const second = addShape(store, child);
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'locked' });
    expect(
        store.actions.checkOperations({
            documentId: store.state.currentDocumentId,
            operations: [
                {
                    op: 'addGroup',
                    name: 'Group',
                    rotation: 0,
                    shapes: [shape, second]
                }
            ]
        }).valid
    ).toBe(false);
});

it('moves a visible frame together with its already hidden descendants', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    store.actions.editFrame({ kind: 'toggle', id: child, flag: 'visible' });
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 100, y: 80 },
        handle: { frameId: root, type: 'move' }
    });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 160, y: 120 } });
    const document = store.state.currentDocument;
    expect(document.frames[root].position).toEqual({ x: 160, y: 120 });
    expect(document.frames[child]).toMatchObject({ position: { x: 160, y: 120 }, visible: false });
    expect(document.shapes[shape]).toMatchObject({ position: { x: 180, y: 140 }, visible: true });
});

it('unselects the shapes a frame holds when the frame is hidden, here or by another copy', () => {
    const { store } = createTestStore();
    const { root, shape } = setup(store);
    const outside = addShape(store);
    const document = store.state.currentDocument;
    store.actions.selectShape(shape);
    store.actions.selectShape(outside);
    expect(document.shapes[shape].selected).toBe(true);
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'visible' });
    expect(document.shapes[shape].selected).toBe(false);
    expect(document.shapes[outside].selected).toBe(true);
    const context = { state: store.state };
    expect(CloneCommand.canExecute(context)).toBe(true);
    store.actions.runCommand(CloneCommand);
    expect(
        document.shapesIds.filter((id) => document.shapes[id].parentFrameId !== undefined)
    ).toEqual([shape]);
});

it('unselects shapes when another copy hides their frame', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const root = Object.values(shownDocument(a).frames).find(
        (frame) => frame.name === 'Screen'
    )!.id;
    const shape = shownDocument(b).shapesIds[0];
    edit(b, (actions) => actions.selectShape(shape));
    edit(a, (actions) => actions.editFrame({ kind: 'toggle', id: root, flag: 'visible' }));
    settle(copies);
    expect(shownDocument(b).frames[root].visible).toBe(false);
    expect(shownDocument(b).shapes[shape].selected).toBe(false);
});

it('leaves what a locked frame holds hidden on Show all, as it is', () => {
    const { store } = createTestStore();
    const { root, child, shape } = setup(store);
    const outside = addShape(store);
    const document = store.state.currentDocument;
    store.actions.toggleShapeVisible(shape);
    store.actions.toggleShapeVisible(outside);
    store.actions.editFrame({ kind: 'toggle', id: child, flag: 'visible' });
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'visible' });
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'locked' });
    store.actions.showAll();
    expect(document.frames[root].visible).toBe(true);
    expect(document.frames[child].visible).toBe(false);
    expect(document.shapes[shape].visible).toBe(false);
    expect(document.shapes[outside].visible).toBe(true);
    store.actions.editFrame({ kind: 'toggle', id: root, flag: 'locked' });
    store.actions.showAll();
    expect(document.frames[child].visible).toBe(true);
    expect(document.shapes[shape].visible).toBe(true);
});

it('moves line and pen geometry without changing the snapshots used by later moves and cancel', () => {
    const { store } = createTestStore();
    const root = addFrame(store, 'Artwork');
    store.actions.addShape({
        type: 'line',
        start: { x: 120, y: 100 },
        end: { x: 160, y: 130 },
        parentFrameId: root,
        selected: false
    });
    store.actions.addShape({
        type: 'pen',
        points: [
            { x: 130, y: 110 },
            { x: 150, y: 140 }
        ],
        parentFrameId: root,
        selected: false,
        bounds: {
            topLeft: { x: 130, y: 110 },
            bottomRight: { x: 150, y: 140 },
            width: 20,
            height: 30
        }
    });
    const document = store.state.currentDocument;
    const [lineId, penId] = document.shapesIds;
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 100, y: 80 },
        handle: { frameId: root, type: 'move' }
    });
    const gesture = store.state.events.pointer.gesture;
    if (gesture.kind !== 'editingFrame') {
        throw new Error('Expected a frame drag');
    }
    const snapshots = json(gesture.shapes);
    store.actions.events.movePointer({ pointerId: 1, position: { x: 150, y: 100 } });
    store.actions.events.movePointer({ pointerId: 1, position: { x: 160, y: 110 } });
    expect(json(gesture.shapes)).toEqual(snapshots);
    expect(document.shapes[lineId]).toMatchObject({
        start: { x: 180, y: 130 },
        end: { x: 220, y: 160 }
    });
    expect(document.shapes[penId]).toMatchObject({
        points: [
            { x: 190, y: 140 },
            { x: 210, y: 170 }
        ],
        bounds: { topLeft: { x: 190, y: 140 }, bottomRight: { x: 210, y: 170 } }
    });
    store.actions.events.cancelGesture();
    expect(json(document.shapes[lineId])).toEqual(snapshots[lineId]);
    expect(json(document.shapes[penId])).toEqual(snapshots[penId]);
});
