import type { Document } from 'src/app/types';
import * as Y from 'yjs';
import { Collaboration, type RemoteChanges } from 'src/app/services/collaboration';
import {
    type Copy,
    DOCUMENT_ID,
    createCopies,
    deliver,
    documentOf,
    edit,
    expectConsistent,
    seeded,
    settle,
    sharedContent,
    sharedState
} from './support/collaboration';
import { createTestStore } from './support/store';

type Random = () => number;
type Actions = Copy['store']['actions'];

const rectangle = (x = 0, y = 0) => ({
    type: 'rectangle' as const,
    position: { x, y },
    size: { width: 20, height: 10 }
});

const pick = <T>(items: T[], random: Random) => items[Math.floor(random() * items.length)];
const some = <T>(items: T[], random: Random) => items.filter(() => random() < 0.4);

/** Edits a copy might make, each using what its document holds when it runs. */
const EDITS: Array<(actions: Actions, document: Document, random: Random) => void> = [
    (actions, _, random) => actions.addShape(rectangle(random() * 500, random() * 500)),
    (actions, { shapes }, random) => {
        const id = pick(Object.keys(shapes), random);

        return id && actions.updateShape({ id, position: { x: random() * 500, y: 0 } });
    },
    (actions, { shapes }, random) => {
        const id = pick(Object.keys(shapes), random);

        return id && actions.updateShape({ id, name: `name ${Math.floor(random() * 9)}` });
    },
    (actions, { shapes }, random) => {
        const id = pick(Object.keys(shapes), random);

        return id && actions.updateShape({ id, rotation: Math.floor(random() * 360) });
    },
    (actions, { shapes }, random) => {
        const id = pick(Object.keys(shapes), random);

        return id && actions.removeShape(id);
    },
    (actions, { shapes }, random) => actions.cloneShapes(some(Object.keys(shapes), random)),
    (actions, { shapes }, random) => actions.bringShapesToFront(some(Object.keys(shapes), random)),
    (actions, { shapes }, random) => actions.sendShapesToBack(some(Object.keys(shapes), random)),
    (actions, { shapes }, random) =>
        actions.addGroup({ shapesIds: some(Object.keys(shapes), random) }),
    (actions, { groups, shapes }, random) => {
        const id = pick(Object.keys(groups), random);

        return id && actions.updateGroup({ id, shapesIds: some(Object.keys(shapes), random) });
    },
    (actions, { groups }, random) => {
        const id = pick(Object.keys(groups), random);

        return id && actions.removeGroup(id);
    },
    (actions, { shapes }, random) => {
        const [source, target] = [
            pick(Object.keys(shapes), random),
            pick(Object.keys(shapes), random)
        ];

        return source && target && actions.addLink({ source, target });
    },
    (actions, { shapes }, random) => {
        const [id, parentShapeId] = [
            pick(Object.keys(shapes), random),
            pick(Object.keys(shapes), random)
        ];

        return id && parentShapeId !== id && actions.updateShape({ id, parentShapeId });
    },
    (actions, { shapes }, random) => {
        const id = pick(Object.keys(shapes), random);

        return id && actions.toggleShapeLocked(id);
    }
];

/** Delivers some of a copy's waiting updates, in a random order. */
function deliverSome(copy: Copy, random: Random) {
    const count = Math.floor(random() * (copy.inbox.length + 1));
    const updates = copy.inbox.splice(0, count).sort(() => random() - 0.5);

    copy.inbox.unshift(...updates);
    deliver(copy, count);
}

/** Each group's members in a copy, as `group shape` pairs. */
const memberships = (copy: Copy) =>
    new Set(
        Object.values(documentOf(copy).groups).flatMap(({ id, shapesIds }) =>
            shapesIds.map((shapeId) => `${id} ${shapeId}`)
        )
    );

/** Builds an update from a peer, including data the editor would not normally create. */
function remoteUpdate(copy: Copy, change: (document: Y.Doc) => void) {
    const document = new Y.Doc();

    Y.applyUpdate(document, copy.collaboration.state(DOCUMENT_ID));

    const before = Y.encodeStateVector(document);

    document.transact(() => change(document));

    const update = Y.encodeStateAsUpdate(document, before);

    document.destroy();

    return update;
}

describe('collaboration', () => {
    it('rejects unsafe or mismatched remote table keys before applying entities', async () => {
        const [copy] = await createCopies(1, (store) =>
            store.actions.addGroup({ id: 'valid-group' })
        );
        const applyRemoteChanges = vi.fn<(changes: RemoteChanges) => void>();
        const collaboration = new Collaboration();

        await collaboration.initialize({
            getDocument: () => documentOf(copy),
            addMutationListener: copy.store.addMutationListener,
            applyRemoteChanges
        });
        collaboration.open(DOCUMENT_ID, copy.collaboration.state(DOCUMENT_ID));
        applyRemoteChanges.mockClear();

        const group = sharedState(copy).groups['valid-group'];
        const update = remoteUpdate(copy, (document) => {
            for (const key of ['__proto__', 'constructor', 'prototype', 'mismatched-id']) {
                document.getMap('groups').set(key, new Y.Map(Object.entries(group)));
            }

            document
                .getMap('groups')
                .set('other-group', new Y.Map(Object.entries({ ...group, id: 'other-group' })));
        });

        collaboration.receive(DOCUMENT_ID, update);

        expect(applyRemoteChanges).toHaveBeenCalledOnce();
        expect(Object.keys(applyRemoteChanges.mock.calls[0][0].entities.groups)).toEqual([
            'other-group'
        ]);
        collaboration.dispose();
    });

    it('does not mutate prototypes or expose shapes under mismatched keys', async () => {
        const [copy] = await createCopies(1, (store) => store.actions.addShape(rectangle()));
        const [id] = documentOf(copy).shapesIds;
        const shape = sharedState(copy).shapes[id];
        const prototype = Object.getOwnPropertyDescriptors(Object.prototype);
        const update = remoteUpdate(copy, (document) => {
            for (const key of ['__proto__', 'constructor', 'prototype', 'mismatched-id']) {
                document.getMap('shapes').set(key, new Y.Map(Object.entries(shape)));
            }
        });

        copy.collaboration.receive(DOCUMENT_ID, update);

        expect(Object.keys(documentOf(copy).shapes)).toEqual([id]);
        expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototype);
        expectConsistent(copy);
    });

    it('applies valid entities alongside malformed remote table values', async () => {
        const [copy] = await createCopies(1, (store) => store.actions.addShape(rectangle()));
        const [id] = documentOf(copy).shapesIds;
        const shape = sharedState(copy).shapes[id];
        const update = remoteUpdate(copy, (document) => {
            document.getMap('shapes').set('malformed', {});
            document.getMap('shapes').set('null-value', null);
            document
                .getMap('shapes')
                .set('valid-shape', new Y.Map(Object.entries({ ...shape, id: 'valid-shape' })));
        });

        expect(() => copy.collaboration.receive(DOCUMENT_ID, update)).not.toThrow();
        expect(documentOf(copy).shapes['valid-shape']).toMatchObject({ id: 'valid-shape' });
        expect(Object.keys(documentOf(copy).shapes)).toHaveLength(2);
        expectConsistent(copy);

        // A later structural change must also tolerate malformed values left in Yjs.
        edit(copy, (actions) => actions.addShape(rectangle(40)));
        expect(Object.keys(documentOf(copy).shapes)).toHaveLength(3);
    });

    it('normalizes component parents in the deleting copy as well as its peers', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addComponent({ id: 'parent' });
            store.actions.addComponent({ id: 'child', parentId: 'parent' });
        });

        edit(copies[0], (actions) => actions.removeComponent('parent'));
        settle(copies);

        copies.forEach((copy) => {
            expect(documentOf(copy).components.child.parentId).toBeUndefined();
            expect(sharedState(copy).components.child.parentId).toBe('parent');
        });
    });

    it('preserves hidden references when a group is renamed before its shape arrives', async () => {
        const copies = await createCopies(3);
        const [a, b, c] = copies;

        edit(a, (actions) => actions.addShape(rectangle()));

        const [id] = documentOf(a).shapesIds;

        deliver(b);
        edit(b, (actions) => actions.addGroup({ id: 'group', shapesIds: [id] }));
        c.inbox.reverse();
        deliver(c, 1);
        expect(documentOf(c).groups.group.shapesIds).toEqual([]);

        edit(c, (actions) => actions.updateGroup({ id: 'group', name: 'renamed' }));
        expect(sharedState(c).groups.group.shapesIds).toEqual([id]);
        settle(copies);

        copies.forEach((copy) => {
            expect(documentOf(copy).groups.group).toMatchObject({
                name: 'renamed',
                shapesIds: [id]
            });
        });
    });

    it('preserves hidden links when the document is renamed before their shapes arrive', async () => {
        const copies = await createCopies(3);
        const [a, b, c] = copies;

        edit(a, (actions) => actions.addShape(rectangle()));

        const [id] = documentOf(a).shapesIds;

        deliver(b);
        edit(b, (actions) => actions.addLink({ id: 'link', source: id }));
        c.inbox.reverse();
        deliver(c, 1);
        expect(documentOf(c).links.link).toBeUndefined();

        edit(c, (actions) => actions.updateDocument({ id: DOCUMENT_ID, name: 'renamed' }));
        expect(sharedState(c).links.link.source).toBe(id);
        settle(copies);

        copies.forEach((copy) => {
            expect(documentOf(copy).links.link.source).toBe(id);
            expect(documentOf(copy).name).toBe('renamed');
        });
    });

    it('starts every copy with the same content', async () => {
        const copies = await createCopies(3, (store) => {
            store.actions.addShape(rectangle());
            store.actions.addShape(rectangle(40));

            const [first, second] = store.state.currentDocument.shapesIds;

            store.actions.addGroup({ id: 'group', shapesIds: [first, second] });
            store.actions.addLink({ id: 'link', source: first, target: second });
            store.actions.updateShape({ id: second, parentShapeId: first });
        });

        copies.forEach((copy) => expect(sharedContent(copy)).toEqual(sharedContent(copies[0])));
    });

    it('keeps changes two copies made to different fields of one shape', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;

        edit(a, (actions) => actions.updateShape({ id, position: { x: 50, y: 60 } }));
        edit(b, (actions) => actions.updateShape({ id, name: 'renamed' }));
        settle(copies);

        copies.forEach((copy) =>
            expect(documentOf(copy).shapes[id]).toMatchObject({
                position: { x: 50, y: 60 },
                name: 'renamed'
            })
        );
    });

    it('lets one value win in every copy when two copies change the same field', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;

        edit(a, (actions) => actions.updateShape({ id, name: 'from a' }));
        edit(b, (actions) => actions.updateShape({ id, name: 'from b' }));
        settle(copies);

        expect(['from a', 'from b']).toContain(documentOf(a).shapes[id].name);
        expect(documentOf(b).shapes[id].name).toBe(documentOf(a).shapes[id].name);
    });

    it('keeps edits two copies made to different coordinates of one shape', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;

        edit(a, (actions) => actions.setShapesProperty({ shapeIds: [id], key: 'x', value: 100 }));
        edit(b, (actions) => actions.setShapesProperty({ shapeIds: [id], key: 'y', value: 200 }));
        settle(copies);

        copies.forEach((copy) =>
            expect(documentOf(copy).shapes[id]).toMatchObject({ position: { x: 100, y: 200 } })
        );
    });

    it('keeps members two copies add to one group at once', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addShape(rectangle());
            store.actions.addShape(rectangle(40));
            store.actions.addShape(rectangle(80));
            store.actions.addGroup({
                id: 'group',
                shapesIds: store.state.currentDocument.shapesIds.slice(0, 1)
            });
        });
        const [a, b] = copies;
        const [first, second, third] = documentOf(a).shapesIds;

        edit(a, (actions) => actions.updateGroup({ id: 'group', shapesIds: [first, second] }));
        edit(b, (actions) => actions.updateGroup({ id: 'group', shapesIds: [first, third] }));
        settle(copies);

        expect([...documentOf(a).groups.group.shapesIds].sort()).toEqual(
            [first, second, third].sort()
        );
        expect(documentOf(b).groups.group.shapesIds).toEqual(documentOf(a).groups.group.shapesIds);
    });

    it('removes a shape deleted in one copy although another copy edits it', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;

        edit(a, (actions) => actions.removeShape(id));
        edit(b, (actions) => actions.updateShape({ id, position: { x: 90, y: 90 } }));
        settle(copies);

        copies.forEach((copy) => {
            expect(documentOf(copy).shapes[id]).toBeUndefined();
            expect(documentOf(copy).shapesIds).toEqual([]);
        });
    });

    it('drops references to a shape deleted in another copy, as deleting it would', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addShape(rectangle());
            store.actions.addShape(rectangle(40));
        });
        const [a, b] = copies;
        const [kept, deleted] = documentOf(a).shapesIds;

        edit(a, (actions) => actions.removeShape(deleted));
        edit(b, (actions) => {
            actions.addGroup({ id: 'group', shapesIds: [kept, deleted] });
            actions.addLink({ id: 'link', source: kept, target: deleted });
            actions.updateShape({ id: kept, parentShapeId: deleted });
        });
        settle(copies);

        copies.forEach((copy) => {
            const document = documentOf(copy);

            expect(document.groups.group.shapesIds).toEqual([kept]);
            expect(document.links.link).toBeUndefined();
            expect(document.shapes[kept].parentShapeId).toBeUndefined();
        });
    });

    it('leaves repairs out of the shared document, so they never override an edit', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addShape(rectangle());
            store.actions.addShape(rectangle(40));
        });
        const [a, b] = copies;
        const [kept, deleted] = documentOf(a).shapesIds;

        edit(a, (actions) => actions.removeShape(deleted));
        edit(b, (actions) => actions.addGroup({ id: 'group', shapesIds: [kept, deleted] }));
        settle(copies);

        copies.forEach((copy) => {
            expect(documentOf(copy).groups.group.shapesIds).toEqual([kept]);
            expect(sharedState(copy).groups.group.shapesIds).toEqual([kept, deleted]);
        });
    });

    it('shows a reference once the shape it refers to arrives', async () => {
        const copies = await createCopies(3);
        const [a, b, c] = copies;

        edit(a, (actions) => actions.addShape(rectangle()));

        const [id] = documentOf(a).shapesIds;

        deliver(b);
        edit(b, (actions) => actions.addGroup({ id: 'group', shapesIds: [id] }));
        c.inbox.reverse();
        deliver(c, 1);

        expect(documentOf(c).groups.group.shapesIds).toEqual([]);

        deliver(c);

        expect(documentOf(c).groups.group.shapesIds).toEqual([id]);
    });

    it('keeps members a copy does not show yet when it edits the member list', async () => {
        const copies = await createCopies(3, (store) => {
            store.actions.addShape(rectangle());
            store.actions.addGroup({
                id: 'group',
                shapesIds: [...store.state.currentDocument.shapesIds]
            });
        });
        const [a, b, c] = copies;

        edit(a, (actions) => actions.addShape(rectangle(40)));

        const [deleted, arriving] = documentOf(a).shapesIds;

        deliver(b);
        edit(b, (actions) => actions.updateGroup({ id: 'group', shapesIds: [deleted, arriving] }));
        c.inbox.reverse();
        deliver(c, 1);
        expect(documentOf(c).groups.group.shapesIds).toEqual([deleted]);

        edit(c, (actions) => actions.removeShape(deleted));
        settle(copies);

        copies.forEach((copy) => {
            expect(documentOf(copy).groups.group.shapesIds).toEqual([arriving]);
            expect(sharedState(copy).groups.group.shapesIds).toEqual([arriving]);
        });
    });

    it('keeps members this copy cannot read when it edits the member list', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addShape(rectangle());
            store.actions.addShape(rectangle(40));
            store.actions.addGroup({
                id: 'group',
                shapesIds: [...store.state.currentDocument.shapesIds]
            });
        });
        const [a] = copies;
        const [deleted, kept] = documentOf(a).shapesIds;
        const update = remoteUpdate(a, (document) => {
            const shape = { ...sharedState(a).shapes[kept], id: 'future', type: 'hologram' };
            const group = document.getMap('groups').get('group') as Y.Map<unknown>;

            document.getMap('shapes').set('future', new Y.Map(Object.entries(shape)));
            (group.get('shapesIds') as Y.Array<string>).push(['future']);
        });

        copies.forEach((copy) => copy.collaboration.receive(DOCUMENT_ID, update));
        edit(a, (actions) => actions.removeShape(deleted));
        settle(copies);

        copies.forEach((copy) => {
            expect(documentOf(copy).groups.group.shapesIds).toEqual([kept]);
            expect(sharedState(copy).groups.group.shapesIds).toEqual([kept, 'future']);
        });
    });

    it('draws shapes two copies brought to the front at once in id order, in every copy', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addShape(rectangle());
            store.actions.addShape(rectangle(40));
            store.actions.addShape(rectangle(80));
        });
        const [a, b] = copies;
        const [first, second] = documentOf(a).shapesIds;

        edit(a, (actions) => actions.bringShapesToFront([first]));
        edit(b, (actions) => actions.bringShapesToFront([second]));
        settle(copies);

        const { shapes, shapesIds } = documentOf(a);

        expect(shapes[first].order).toBe(shapes[second].order);
        expect(shapesIds.slice(1)).toEqual([first, second].sort());
        expect(documentOf(b).shapesIds).toEqual(shapesIds);
    });

    it('keeps the selection and the camera to each copy', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;

        a.store.actions.unselectShapes();
        b.store.actions.unselectShapes();
        edit(a, (actions) => {
            actions.selectShape(id);
            actions.tools.panCamera({ dx: 90, dy: -40 });
        });
        edit(b, (actions) => actions.updateShape({ id, name: 'renamed' }));
        settle(copies);

        expect(documentOf(a).shapes[id]).toMatchObject({ name: 'renamed', selected: true });
        expect(documentOf(b).shapes[id].selected).toBe(false);
        expect(documentOf(b).camera).not.toEqual(documentOf(a).camera);
    });

    it('keeps sharing a document that is opened again', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;

        a.collaboration.open(DOCUMENT_ID);
        edit(b, (actions) => actions.updateShape({ id, name: 'from b' }));
        a.collaboration.open(DOCUMENT_ID, b.collaboration.state(DOCUMENT_ID));
        edit(b, (actions) => actions.updateShape({ id, position: { x: 77, y: 77 } }));
        settle(copies);

        copies.forEach((copy) =>
            expect(documentOf(copy).shapes[id]).toMatchObject({
                name: 'from b',
                position: { x: 77, y: 77 }
            })
        );
    });

    it('refuses to share a document the store does not hold', async () => {
        const [copy] = await createCopies(1, (store) => store.actions.addShape(rectangle()));
        const collaboration = new Collaboration();
        const { store } = createTestStore({}, { collaboration });

        await collaboration.initialize({
            getDocument: (documentId) => store.state.documents[documentId],
            applyRemoteChanges: store.actions.applyRemoteChanges,
            addMutationListener: store.addMutationListener
        });

        expect(() => collaboration.open('other', copy.collaboration.state(DOCUMENT_ID))).toThrow(
            'Document other is not in the store'
        );
    });

    it('writes waiting changes before encoding the state or closing', async () => {
        const copies = await createCopies(2);
        const [a, b] = copies;

        a.store.actions.addShape(rectangle());
        expect(Object.keys(sharedState(a).shapes)).toHaveLength(1);

        b.store.actions.addShape(rectangle(40));
        b.collaboration.close(DOCUMENT_ID);
        deliver(a);
        expect(Object.keys(documentOf(a).shapes)).toHaveLength(2);
    });

    it('merges saved updates into one that restores the document', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;
        const start = a.collaboration.state(DOCUMENT_ID);

        edit(a, (actions) => actions.addShape(rectangle(40)));
        edit(a, (actions) => actions.updateShape({ id, name: 'renamed' }));

        const collaboration = new Collaboration();
        const { store } = createTestStore({}, { collaboration });
        const restored: Copy = { store, collaboration, inbox: [] };

        await collaboration.initialize({
            getDocument: (documentId) => store.state.documents[documentId],
            applyRemoteChanges: store.actions.applyRemoteChanges,
            addMutationListener: store.addMutationListener
        });
        collaboration.open(DOCUMENT_ID, a.collaboration.merge([start, ...b.inbox]));

        expect(sharedContent(restored)).toEqual(sharedContent(a));
        expect(documentOf(restored).shapes[id].name).toBe('renamed');
    });

    it('shares a drag once, when it ends', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;
        const { events } = a.store.actions;

        a.store.actions.unselectShapes();
        events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });

        for (let x = 6; x <= 30; x++) {
            events.movePointer({ pointerId: 1, position: { x, y: 5 } });
            a.collaboration.flush();
        }

        expect(b.inbox).toHaveLength(0);

        events.endGesture({ pointerId: 1, position: { x: 30, y: 5 } });
        await Promise.resolve();

        expect(b.inbox).toHaveLength(1);
        deliver(b);
        expect(documentOf(b).shapes[id]).toMatchObject({ position: { x: 25, y: 0 } });
    });

    it('keeps a drag and another copy’s edit made during it', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;
        const { events } = a.store.actions;

        a.store.actions.unselectShapes();
        events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });
        events.movePointer({ pointerId: 1, position: { x: 15, y: 5 } });
        edit(b, (actions) => actions.updateShape({ id, name: 'renamed' }));
        deliver(a);
        expect(documentOf(a).shapes[id]).toMatchObject({
            name: 'renamed',
            position: { x: 10, y: 0 }
        });

        events.endGesture({ pointerId: 1, position: { x: 25, y: 5 } });
        await Promise.resolve();
        settle(copies);

        copies.forEach((copy) =>
            expect(documentOf(copy).shapes[id]).toMatchObject({
                name: 'renamed',
                position: { x: 20, y: 0 }
            })
        );
    });

    it('cancels a drag without undoing another copy’s edit made during it', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;
        const { events } = a.store.actions;

        a.store.actions.unselectShapes();
        events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });
        events.movePointer({ pointerId: 1, position: { x: 15, y: 5 } });
        edit(b, (actions) => actions.updateShape({ id, name: 'renamed' }));
        deliver(a);
        events.cancelGesture();
        await Promise.resolve();
        settle(copies);

        copies.forEach((copy) =>
            expect(documentOf(copy).shapes[id]).toMatchObject({
                name: 'renamed',
                position: { x: 0, y: 0 }
            })
        );
    });

    it('cancels only the coordinate a drag changed when another copy moved the shape during it', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;
        const { events } = a.store.actions;

        a.store.actions.unselectShapes();
        events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });
        events.movePointer({ pointerId: 1, position: { x: 5, y: 15 } });
        edit(b, (actions) => actions.updateShape({ id, position: { x: 50, y: 0 } }));
        deliver(a);
        expect(documentOf(a).shapes[id]).toMatchObject({ position: { x: 50, y: 10 } });

        events.cancelGesture();
        await Promise.resolve();
        settle(copies);

        copies.forEach((copy) =>
            expect(documentOf(copy).shapes[id]).toMatchObject({ position: { x: 50, y: 0 } })
        );
    });

    it('cancels a drag without bringing back a shape another copy deleted during it', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addShape(rectangle());
            store.actions.addShape(rectangle(100));
        });
        const [a, b] = copies;
        const [first, second] = documentOf(a).shapesIds;
        const { events } = a.store.actions;

        a.store.actions.selectShape(first);
        a.store.actions.selectShape(second);
        events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });
        events.movePointer({ pointerId: 1, position: { x: 15, y: 5 } });
        edit(b, (actions) => actions.removeShape(second));
        deliver(a);
        events.cancelGesture();
        await Promise.resolve();
        settle(copies);

        copies.forEach((copy) => {
            expect(documentOf(copy).shapes[second]).toBeUndefined();
            expect(documentOf(copy).shapes[first]).toMatchObject({ position: { x: 0, y: 0 } });
            expectConsistent(copy);
        });
    });

    it('keeps a shape deleted while paused deleted, although another copy edits it', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = documentOf(a).shapesIds;

        a.collaboration.pause();
        edit(a, (actions) => actions.removeShape(id));
        edit(b, (actions) => actions.updateShape({ id, name: 'renamed' }));
        deliver(a);
        expect(documentOf(a).shapes[id]).toBeUndefined();

        a.collaboration.resume();
        settle(copies);

        copies.forEach((copy) => expect(documentOf(copy).shapes[id]).toBeUndefined());
    });

    it.each(Array.from({ length: 30 }, (_, index) => index + 1))(
        'keeps every copy the same, and every member added and not removed, after random edits and pauses (seed %i)',
        async (seed) => {
            const random = seeded(seed);
            const copies = await createCopies(3, (store) => {
                for (let index = 0; index < 4; index++) {
                    store.actions.addShape(rectangle(index * 40));
                }
            });
            const added = new Set<string>();
            const removed = new Set<string>();
            const paused = new Set<Copy>();

            for (let step = 0; step < 150; step++) {
                const copy = pick(copies, random);

                if (random() < 0.3) {
                    deliverSome(copy, random);
                    continue;
                }

                if (random() < 0.1) {
                    if (paused.delete(copy)) {
                        copy.collaboration.resume();
                    } else {
                        paused.add(copy);
                        copy.collaboration.pause();
                    }

                    continue;
                }

                const before = memberships(copy);

                edit(copy, (actions) => pick(EDITS, random)(actions, documentOf(copy), random));

                const after = memberships(copy);

                after.forEach((member) => before.has(member) || added.add(member));
                before.forEach((member) => after.has(member) || removed.add(member));
            }

            paused.forEach((copy) => copy.collaboration.resume());
            settle(copies);

            const { groups, shapes } = documentOf(copies[0]);
            const survivors = [...added].filter((member) => {
                const [groupId, shapeId] = member.split(' ');

                return !removed.has(member) && groupId in groups && shapeId in shapes;
            });

            copies.forEach((copy) => {
                expect(sharedContent(copy)).toEqual(sharedContent(copies[0]));
                expect(sharedState(copy)).toEqual(sharedState(copies[0]));
                expectConsistent(copy);
                expect(survivors.filter((member) => !memberships(copy).has(member))).toEqual([]);
            });
        }
    );
});
