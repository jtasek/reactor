import { createShape } from '../factories';
import { SHAPE_PROPERTIES, applyProperty, sharedProperties } from '../properties';

const rect = (x: number) =>
    createShape({
        type: 'rectangle',
        position: { x, y: 20 },
        size: { width: 40, height: 30 },
        name: 'Box'
    });
const text = (value: string) =>
    createShape({ type: 'text', position: { x: 0, y: 40 }, value, fontSize: 20, name: 'Label' });
const property = (key: string) => SHAPE_PROPERTIES.find((item) => item.key === key)!;
const rows = (shapes: Parameters<typeof sharedProperties>[0]) =>
    Object.fromEntries(
        sharedProperties(shapes).map(({ property, value, mixed }) => [
            property.key,
            mixed ? 'mixed' : value
        ])
    );

describe('sharedProperties()', () => {
    it('lists the properties of a single shape with their values', () => {
        expect(rows([rect(10)])).toEqual({
            name: 'Box',
            x: 10,
            y: 20,
            width: 40,
            height: 30,
            rotation: 0,
            visible: true,
            locked: false
        });
    });

    it('marks values that differ between shapes as mixed', () => {
        expect(rows([rect(10), rect(50)])).toMatchObject({ x: 'mixed', y: 20, name: 'Box' });
    });

    it('only offers properties every shape has', () => {
        expect(rows([rect(10), text('a')])).not.toHaveProperty('text');
        expect(rows([text('a'), text('b')])).toMatchObject({ text: 'mixed', fontSize: 20 });
    });

    it('compares numbers as shown, so float noise is not mixed', () => {
        expect(rows([rect(10.001), rect(10.004)])).toMatchObject({ x: 10 });
    });

    it('offers nothing for an empty selection', () => {
        expect(sharedProperties([])).toEqual([]);
    });
});

describe('applyProperty()', () => {
    it('ignores values of the wrong type or out of range', () => {
        const shape = rect(10);

        applyProperty(property('x'), shape, '99');
        applyProperty(property('x'), shape, Number.NaN);
        applyProperty(property('rotation'), shape, Infinity);
        applyProperty(property('name'), shape, '   ');
        applyProperty(property('locked'), shape, 'yes');

        expect(shape).toMatchObject({
            position: { x: 10 },
            rotation: 0,
            name: 'Box',
            locked: false
        });

        const label = text('a');

        applyProperty(property('fontSize'), label, 0);

        expect(label).toMatchObject({ fontSize: 20 });
    });

    it('does not write read-only properties', () => {
        const shape = rect(10);

        applyProperty(property('width'), shape, 99);

        expect(shape).toMatchObject({ size: { width: 40 } });
    });
});
