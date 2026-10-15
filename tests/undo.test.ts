import { createOvermind } from 'overmind';
import * as Y from 'yjs';
import { config } from 'src/app';
import { createApplication, createDocument } from 'src/app/factories';
import { Collaboration } from 'src/app/services/collaboration';
import { listenToMutations } from 'src/app/services/mutations';
import { RedoCommand, UndoCommand } from 'src/commands';
import {
    type Copy,
    DOCUMENT_ID,
    createCopies,
    edit,
    expectConsistent,
    settle,
    sharedContent,
    shownDocument
} from './support/collaboration';

const rectangle = (x = 0, y = 0) => ({
    type: 'rectangle' as const,
    position: { x, y },
    size: { width: 20, height: 10 }
});

/** Longer than any test takes, so a copy's changes join as a person's typing does. */
const JOINED_MS = 60_000;

const undo = (copy: Copy) => copy.collaboration.undo(DOCUMENT_ID);
const redo = (copy: Copy) => copy.collaboration.redo(DOCUMENT_ID);
const history = (copy: Copy) => shownDocument(copy).history;

describe('undo', () => {
    it('undoes and redoes a shape a copy added, in every copy', async () => {
        const copies = await createCopies(2);
        const [a, b] = copies;

        edit(a, (actions) => actions.addShape(rectangle()));
        const [id] = shownDocument(a).shapesIds;

        undo(a);
        settle(copies);
        copies.forEach((copy) => expect(shownDocument(copy).shapesIds).toEqual([]));

        redo(a);
        settle(copies);
        copies.forEach((copy) => expect(shownDocument(copy).shapesIds).toEqual([id]));
        expect(sharedContent(b)).toEqual(sharedContent(a));
    });

    it('leaves the changes other copies made', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = shownDocument(a).shapesIds;

        edit(a, (actions) => actions.updateShape({ id, name: 'from a' }));
        settle(copies);
        edit(b, (actions) => actions.updateShape({ id, position: { x: 50, y: 60 } }));
        edit(b, (actions) => actions.addShape(rectangle(100)));
        settle(copies);

        undo(a);
        settle(copies);

        copies.forEach((copy) => {
            expect(shownDocument(copy).shapes[id]).toMatchObject({
                name: 'rectangle-1',
                position: { x: 50, y: 60 }
            });
            expect(shownDocument(copy).shapesIds).toHaveLength(2);
        });
        expect(history(b)).toEqual({ canUndo: true, canRedo: false });
    });

    it('never undoes another copy’s change to the same field', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = shownDocument(a).shapesIds;

        edit(a, (actions) => actions.updateShape({ id, name: 'from a' }));
        settle(copies);
        edit(b, (actions) => actions.updateShape({ id, name: 'from b' }));
        settle(copies);

        undo(a);
        settle(copies);

        copies.forEach((copy) => expect(shownDocument(copy).shapes[id].name).toBe('from b'));
    });

    it('has nothing to undo once a document opens', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));

        copies.forEach((copy) => {
            expect(history(copy)).toEqual({ canUndo: false, canRedo: false });
            undo(copy);
        });
        settle(copies);

        copies.forEach((copy) => expect(shownDocument(copy).shapesIds).toHaveLength(1));
    });

    it('tells the store what can be undone and redone', async () => {
        const copies = await createCopies(1);
        const [a] = copies;

        edit(a, (actions) => actions.addShape(rectangle()));
        expect(history(a)).toEqual({ canUndo: true, canRedo: false });

        undo(a);
        expect(history(a)).toEqual({ canUndo: false, canRedo: true });

        redo(a);
        expect(history(a)).toEqual({ canUndo: true, canRedo: false });

        undo(a);
        edit(a, (actions) => actions.addShape(rectangle(40)));
        expect(history(a)).toEqual({ canUndo: true, canRedo: false });
    });

    it('brings back a deleted shape with its place in its group', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addShape(rectangle());
            store.actions.addShape(rectangle(40));
            store.actions.addGroup({
                id: 'group',
                shapesIds: store.state.currentDocument.shapesIds
            });
        });
        const [a, b] = copies;
        const [first, second] = shownDocument(a).shapesIds;

        edit(a, (actions) => actions.removeShape(first));
        settle(copies);
        expect(shownDocument(b).groups.group.shapesIds).toEqual([second]);

        undo(a);
        settle(copies);

        copies.forEach((copy) => {
            expect(shownDocument(copy).shapesIds).toEqual([first, second]);
            expect([...shownDocument(copy).groups.group.shapesIds].sort()).toEqual(
                [first, second].sort()
            );
            expectConsistent(copy);
        });
    });

    it('undoes changes made while sharing was held as one', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a] = copies;
        const [id] = shownDocument(a).shapesIds;

        a.collaboration.pause();
        edit(a, (actions) => actions.updateShape({ id, position: { x: 10, y: 0 } }));
        edit(a, (actions) => actions.updateShape({ id, position: { x: 20, y: 0 } }));
        undo(a);
        expect(shownDocument(a).shapes[id]).toMatchObject({ position: { x: 20, y: 0 } });
        a.collaboration.resume();
        a.collaboration.flush();

        undo(a);
        settle(copies);

        copies.forEach((copy) =>
            expect(shownDocument(copy).shapes[id]).toMatchObject({ position: { x: 0, y: 0 } })
        );
    });

    it('undoes a change that has not been shared yet', async () => {
        const copies = await createCopies(2);
        const [a] = copies;

        a.store.actions.addShape(rectangle());
        undo(a);
        settle(copies);

        copies.forEach((copy) => expect(shownDocument(copy).shapesIds).toEqual([]));
    });

    it('runs from the Undo and Redo commands', async () => {
        const copies = await createCopies(2);
        const [a, b] = copies;
        const run = (command: typeof UndoCommand) => a.store.actions.runCommand(command);

        expect(run(UndoCommand)).toBe(false);
        edit(a, (actions) => actions.addShape(rectangle()));

        expect(run(UndoCommand)).toBe(true);
        expect(run(RedoCommand)).toBe(true);
        settle(copies);

        expect(shownDocument(b).shapesIds).toHaveLength(1);
        expect(history(a)).toEqual({ canUndo: true, canRedo: false });
    });

    it('undoes a paste as one step, apart from the changes just before and after it', async () => {
        const copies = await createCopies(2, () => {}, JOINED_MS);
        const [a, b] = copies;

        edit(a, (actions) => actions.addShape(rectangle()));
        edit(a, (actions) => actions.addShape(rectangle(40)));
        const [first, second] = shownDocument(a).shapesIds;

        edit(a, (actions) => actions.selectShape(first));
        edit(a, (actions) => actions.selectShape(second));
        const copied = a.store.actions.copySelection() ?? '';

        edit(a, (actions) => actions.updateShape({ id: first, name: 'before' }));
        edit(a, (actions) => actions.pasteShapes(copied));
        const pasted = shownDocument(a).shapesIds.slice(2);

        edit(a, (actions) => actions.updateShape({ id: pasted[0], name: 'renamed' }));
        settle(copies);
        expect(shownDocument(b).shapesIds).toHaveLength(4);

        undo(a);
        settle(copies);
        copies.forEach((copy) =>
            expect(shownDocument(copy).shapes[pasted[0]].name).not.toBe('renamed')
        );

        undo(a);
        settle(copies);
        copies.forEach((copy) => {
            expect(shownDocument(copy).shapesIds).toEqual([first, second]);
            expect(shownDocument(copy).shapes[first].name).toBe('before');
            expectConsistent(copy);
        });

        redo(a);
        settle(copies);
        copies.forEach((copy) => expect(shownDocument(copy).shapesIds).toHaveLength(4));
        expect(sharedContent(b)).toEqual(sharedContent(a));
    });

    it('closes a batch before another action runs in the same task', async () => {
        const collaboration = new Collaboration(JOINED_MS);
        const document = createDocument({ id: DOCUMENT_ID });
        const store = createOvermind(
            {
                ...config,
                state: {
                    ...config.state,
                    ...createApplication({
                        currentDocumentId: DOCUMENT_ID,
                        documents: { [DOCUMENT_ID]: document }
                    })
                },
                effects: { ...config.effects, collaboration },
                actions: { ...config.actions, onInitializeOvermind: () => {} }
            },
            { devtools: false, hotReloading: false }
        );
        const shared = new Y.Doc();
        const authors = () => collaboration.undoAuthors(DOCUMENT_ID);
        const shapes = () => shared.getMap('shapes').toJSON();
        const by = { kind: 'ai', model: 'claude-haiku-5-5', requestId: 'request' } as const;

        await collaboration.initialize({
            getDocument: (documentId) => store.state.documents[documentId],
            applyRemoteChanges: store.actions.applyRemoteChanges,
            addMutationListener: listenToMutations(store),
            historyChanged: (documentId, history) =>
                store.actions.setDocumentHistory({ documentId, history }),
            sendUpdate: (_, update) => Y.applyUpdate(shared, update)
        });
        collaboration.open(DOCUMENT_ID);

        const result = store.actions.applyOperations({
            documentId: DOCUMENT_ID,
            by,
            operations: [
                { op: 'addShape', key: 'proposed', shape: { ...rectangle(), name: 'Proposed' } }
            ]
        });
        expect(result.applied).toBe(true);
        const [id] = store.state.currentDocument.shapesIds;

        store.actions.updateShape({ id, name: 'Renamed' });
        collaboration.flush();

        expect(authors()).toEqual([by, { kind: 'person' }]);
        expect(shapes()[id]).toMatchObject({ name: 'Renamed' });

        collaboration.undo(DOCUMENT_ID);
        expect(store.state.currentDocument.shapesIds).toEqual([id]);
        expect(store.state.currentDocument.shapes[id].name).toBe('Proposed');
        expect(shapes()[id]).toMatchObject({ name: 'Proposed' });
        expect(authors()).toEqual([by]);

        collaboration.undo(DOCUMENT_ID);
        expect(store.state.currentDocument.shapesIds).toEqual([]);
        expect(shapes()).toEqual({});
        expect(authors()).toEqual([]);

        collaboration.redo(DOCUMENT_ID);
        expect(store.state.currentDocument.shapes[id].name).toBe('Proposed');
        expect(shapes()[id]).toMatchObject({ name: 'Proposed' });
        expect(authors()).toEqual([by]);

        collaboration.redo(DOCUMENT_ID);
        expect(store.state.currentDocument.shapes[id].name).toBe('Renamed');
        expect(shapes()[id]).toMatchObject({ name: 'Renamed' });
        expect(authors()).toEqual([by, { kind: 'person' }]);

        collaboration.dispose();
        shared.destroy();
    });

    it('keeps a batch held with the changes made during a gesture', async () => {
        const copies = await createCopies(2);
        const [a, b] = copies;

        a.collaboration.pause();
        const result = a.store.actions.applyOperations({
            documentId: DOCUMENT_ID,
            by: { kind: 'ai', model: 'claude-haiku-5-5', requestId: 'request' },
            operations: [{ op: 'addShape', key: 'proposed', shape: rectangle() }]
        });
        expect(result.applied).toBe(true);
        const [id] = shownDocument(a).shapesIds;

        a.store.actions.updateShape({ id, name: 'Held change' });
        settle(copies);
        expect(shownDocument(b).shapesIds).toEqual([]);
        expect(history(a)).toEqual({ canUndo: false, canRedo: false });

        a.collaboration.resume();
        settle(copies);
        expect(shownDocument(b).shapes[id].name).toBe('Held change');
        expect(a.collaboration.undoAuthors(DOCUMENT_ID)).toEqual([{ kind: 'person' }]);

        undo(a);
        settle(copies);
        copies.forEach((copy) => expect(shownDocument(copy).shapesIds).toEqual([]));
    });

    it('records who made each step, through undo and redo', async () => {
        const copies = await createCopies(2);
        const [a, b] = copies;
        const by = { kind: 'ai', model: 'claude-haiku-5-5', requestId: 'request' } as const;
        const authors = (copy: Copy) => copy.collaboration.undoAuthors(DOCUMENT_ID);

        edit(a, (actions) => actions.addShape(rectangle()));
        edit(a, (actions) =>
            actions.applyOperations({
                documentId: DOCUMENT_ID,
                by,
                operations: [
                    {
                        op: 'addShape',
                        key: 'proposed',
                        shape: rectangle(40)
                    }
                ]
            })
        );
        expect(authors(a)).toEqual([{ kind: 'person' }, by]);

        undo(a);
        expect(authors(a)).toEqual([{ kind: 'person' }]);
        redo(a);
        expect(authors(a)).toEqual([{ kind: 'person' }, by]);

        settle(copies);
        expect(authors(b)).toEqual([]);
    });

    it('adds no step and shares nothing for a batch it refuses', async () => {
        const copies = await createCopies(2);
        const [a, b] = copies;
        const before = sharedContent(b);

        edit(a, (actions) =>
            actions.applyOperations({
                documentId: DOCUMENT_ID,
                by: { kind: 'person' },
                operations: [
                    { op: 'addShape', key: 'box', shape: rectangle() },
                    { op: 'addGroup', name: 'Pair', rotation: 0, shapes: ['box', 'missing'] }
                ]
            })
        );
        settle(copies);

        expect(history(a)).toEqual({ canUndo: false, canRedo: false });
        expect(sharedContent(a)).toEqual(before);
        expect(sharedContent(b)).toEqual(before);
    });
});
