import { sharedProperties } from 'src/app/properties';
import type { ShapeInput } from 'src/app/types';
import { createTestStore } from './support/store';

function setup(...inputs: ShapeInput[]) {
    const { store } = createTestStore();

    inputs.forEach((input) => store.actions.addShape(input));

    const ids = [...store.state.currentDocument.shapesIds];
    const shape = (index: number) => store.state.currentDocument.shapes[ids[index]];
    const rows = (indexes = ids.map((_, index) => index)) =>
        Object.fromEntries(
            sharedProperties(indexes.map(shape), store.state.currentDocument).map(
                ({ property, value, mixed, readOnly }) => [
                    property.key,
                    { value: mixed ? 'mixed' : value, readOnly }
                ]
            )
        );
    const set = (key: string, value: string | number | boolean) =>
        store.actions.setShapesProperty({ shapeIds: ids, key, value });

    return { store, ids, shape, rows, set };
}

const rect = (x: number, name = 'Box'): ShapeInput => ({
    type: 'rectangle',
    position: { x, y: 20 },
    size: { width: 40, height: 30 },
    name
});
const line: ShapeInput = { type: 'line', start: { x: 100, y: 0 }, end: { x: 140, y: 60 } };
const text = (value: string): ShapeInput => ({
    type: 'text',
    position: { x: 0, y: 40 },
    value,
    fontSize: 20
});

describe('sharedProperties()', () => {
    it('lists the properties of a single shape with their values', () => {
        const { rows } = setup(rect(10));

        expect(rows()).toEqual({
            name: { value: 'Box', readOnly: false },
            x: { value: 10, readOnly: false },
            y: { value: 20, readOnly: false },
            width: { value: 40, readOnly: true },
            height: { value: 30, readOnly: true },
            rotation: { value: 0, readOnly: false },
            visible: { value: true, readOnly: false },
            locked: { value: false, readOnly: false }
        });
    });

    it('marks differing values as mixed and only offers properties every shape has', () => {
        const { rows } = setup(rect(10), rect(50), text('a'), text('b'));

        expect(rows([0, 1])).toMatchObject({ x: { value: 'mixed' }, y: { value: 20 } });
        expect(rows([0, 2])).not.toHaveProperty('text');
        expect(rows([2, 3])).toMatchObject({ text: { value: 'mixed' }, fontSize: { value: 20 } });
    });

    it('compares numbers as shown, so float noise is not mixed', () => {
        const { rows } = setup(rect(10.001), rect(10.004));

        expect(rows()).toMatchObject({ x: { value: 10 } });
    });

    it('offers nothing for an empty selection', () => {
        const { store } = setup();

        expect(sharedProperties([], store.state.currentDocument)).toEqual([]);
    });

    it('shows locks from layers as locked and read-only', () => {
        const { store, ids, rows } = setup(rect(10));

        store.actions.addLayer({ id: 'layer', shapesIds: [ids[0]], locked: true });

        expect(rows()).toMatchObject({
            name: { readOnly: false },
            x: { readOnly: true },
            locked: { value: true, readOnly: true }
        });
    });

    it('lets a shape locked by its own flag be unlocked, but not moved', () => {
        const { store, ids, rows } = setup(rect(10));

        store.actions.lockShape(ids[0]);

        expect(rows()).toMatchObject({
            x: { readOnly: true },
            locked: { value: true, readOnly: false }
        });
    });
});

describe('setShapesProperty', () => {
    it('applies a value to every shape, whatever its geometry', () => {
        const { set, shape } = setup(rect(10), line);

        set('x', 300);
        set('rotation', 45);

        expect(shape(0)).toMatchObject({ position: { x: 300, y: 20 }, rotation: 45 });
        expect(shape(1)).toMatchObject({ start: { x: 300, y: 0 }, end: { x: 340, y: 60 } });
    });

    it('only changes metadata on locked shapes', () => {
        const { store, ids, set, shape } = setup(rect(10), line);

        store.actions.lockShape(ids[0]);
        set('x', 300);
        set('name', 'Renamed');

        expect(shape(0)).toMatchObject({ position: { x: 10 }, name: 'Renamed' });
        expect(shape(1)).toMatchObject({ start: { x: 300 }, name: 'Renamed' });

        set('locked', false);

        expect(shape(0).locked).toBe(false);
    });

    it('cannot unlock a shape locked by its layer, or change anything in a locked document', () => {
        const { store, ids, set, shape } = setup(rect(10, 'Box'));

        store.actions.addLayer({ id: 'layer', shapesIds: [ids[0]], locked: true });
        set('locked', true);
        set('locked', false);

        expect(shape(0).locked).toBe(false);

        store.actions.updateDocument({ id: store.state.currentDocumentId, locked: true });
        set('name', 'Renamed');
        set('visible', false);

        expect(shape(0)).toMatchObject({ name: 'Box', visible: true });
    });

    it('ignores unknown properties', () => {
        const { set, shape } = setup(rect(10));

        set('colour', 'red');

        expect(shape(0)).not.toHaveProperty('colour');
    });
});
