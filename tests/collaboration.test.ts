import type { Document } from 'src/app/types';
import * as Y from 'yjs';
import { Collaboration } from 'src/app/services/collaboration';
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
        const applyRemoteChanges = vi.fn();
        const collaboration = new Collaboration();

        await collaboration.initialize({
            getDocument: () => documentOf(copy),
            addMutationListener: copy.store.addMutationListener,
            applyRemoteChanges
        });
        collaboration.open(DOCUMENT_ID, copy.collaboration.state(DOCUMENT_ID));
        applyRemoteChanges.mockClear();

        const update = remoteUpdate(copy, (document) => {
            for (const key of ['__proto__', 'constructor', 'prototype', 'mismatched-id']) {
                document
                    .getMap('groups')
                    .set(key, new Y.Map(Object.entries(sharedState(copy).groups['valid-group'])));
            }
        });

        collaboration.receive(DOCUMENT_ID, update);

        expect(applyRemoteChanges).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                entities: expect.objectContaining({
                    groups: expect.objectContaining(
                        Object.fromEntries(
                            ['__proto__', 'constructor', 'prototype', 'mismatched-id'].map((id) => [
                                id,
                                null
                            ])
                        )
                    )
                })
            })
        );
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

    it.each(Array.from({ length: 30 }, (_, index) => index + 1))(
        'keeps every copy the same after random concurrent edits (seed %i)',
        async (seed) => {
            const random = seeded(seed);
            const copies = await createCopies(3, (store) => {
                for (let index = 0; index < 4; index++) {
                    store.actions.addShape(rectangle(index * 40));
                }
            });

            for (let step = 0; step < 150; step++) {
                const copy = pick(copies, random);

                if (random() < 0.3) {
                    deliverSome(copy, random);
                    continue;
                }

                edit(copy, (actions) => pick(EDITS, random)(actions, documentOf(copy), random));
            }

            settle(copies);

            copies.forEach((copy) => {
                expect(sharedContent(copy)).toEqual(sharedContent(copies[0]));
                expect(sharedState(copy)).toEqual(sharedState(copies[0]));
                expectConsistent(copy);
            });
        }
    );
});
