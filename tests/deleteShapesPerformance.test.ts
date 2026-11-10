import { deleteShapes } from 'src/app/deleteShape';
import { createDocument, createGroup, createShape } from 'src/app/factories';
import { createTestStore } from './support/store';

/** A store whose document holds `count` rectangles, the first one a child's parent. */
function storeWith(count: number) {
    const { store } = createTestStore();

    for (let index = 0; index < count; index++) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: index * 10, y: 0 },
            size: { width: 6, height: 6 }
        });
    }

    return store;
}

describe('deleting many shapes', () => {
    it('writes only what holds a removed shape', () => {
        const store = storeWith(120);
        const document = store.state.currentDocument;
        const removed = document.shapesIds.slice(0, 40);
        const kept = document.shapesIds.slice(40);
        let writes = 0;
        const stop = store.addMutationListener(() => {
            writes++;
        });

        store.actions.removeShapes(removed);
        stop();

        expect(store.state.currentDocument.shapesIds).toEqual(kept);
        expect(Object.keys(store.state.currentDocument.shapes).sort()).toEqual([...kept].sort());
        // One write per removed shape, plus the lists that held them. Writing to
        // every remaining shape per removed one made this 40 × 120.
        expect(writes).toBeLessThan(removed.length * 3);
    });

    it('drops references to every removed shape', () => {
        const shapes = ['a', 'b', 'c', 'd'].map((id) =>
            createShape({
                type: 'rectangle',
                name: id,
                order: `a${id}`,
                position: { x: 0, y: 0 },
                size: { width: 5, height: 5 },
                selected: false
            })
        );
        const document = createDocument({
            id: 'doc',
            shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
            shapesIds: shapes.map((shape) => shape.id)
        });

        const [a, b, c, d] = shapes.map((shape) => shape.id);

        document.shapes[d].parentShapeId = a;
        document.shapes[d].children = [document.shapes[b]];
        document.groups.g = { ...createGroup({ name: 'g', shapesIds: [a, c] }), id: 'g' };
        document.links.l = { id: 'l', source: b, target: c, selected: false } as never;

        deleteShapes(document, [a, b]);

        expect(document.shapesIds).toEqual([c, d]);
        expect(Object.keys(document.shapes)).toEqual([c, d]);
        expect(document.shapes[d].parentShapeId).toBeUndefined();
        expect(document.shapes[d].children).toEqual([]);
        expect(document.groups.g.shapesIds).toEqual([c]);
        expect(document.links.l).toBeUndefined();
    });
});
