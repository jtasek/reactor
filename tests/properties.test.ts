import { createTestStore } from './support/store';

function setup() {
    const { store } = createTestStore();

    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 40, height: 30 }
    });
    store.actions.addShape({ type: 'line', start: { x: 100, y: 0 }, end: { x: 140, y: 60 } });

    const ids = [...store.state.currentDocument.shapesIds];
    const set = (key: string, value: string | number | boolean) =>
        store.actions.setShapesProperty({ shapeIds: ids, key, value });

    return {
        store,
        ids,
        set,
        shape: (index: number) => store.state.currentDocument.shapes[ids[index]]
    };
}

describe('setShapesProperty', () => {
    it('applies a value to every shape, whatever its geometry', () => {
        const { set, shape } = setup();

        set('x', 300);
        set('rotation', 45);

        expect(shape(0)).toMatchObject({ position: { x: 300, y: 20 }, rotation: 45 });
        expect(shape(1)).toMatchObject({ start: { x: 300, y: 0 }, end: { x: 340, y: 60 } });
    });

    it('only changes metadata on locked shapes', () => {
        const { store, ids, set, shape } = setup();

        store.actions.lockShape(ids[0]);
        set('x', 300);
        set('name', 'Renamed');

        expect(shape(0)).toMatchObject({ position: { x: 10 }, name: 'Renamed' });
        expect(shape(1)).toMatchObject({ start: { x: 300 }, name: 'Renamed' });

        set('locked', false);

        expect(shape(0).locked).toBe(false);
    });

    it('ignores unknown properties', () => {
        const { set, shape } = setup();

        set('colour', 'red');

        expect(shape(0)).not.toHaveProperty('colour');
    });
});
