import type { Document } from 'src/app/types';
import {
    type Copy,
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

describe('collaboration', () => {
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
