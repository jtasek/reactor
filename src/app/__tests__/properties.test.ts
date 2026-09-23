import { createShape } from '../factories';
import { SHAPE_PROPERTIES, applyProperty } from '../properties';

const rect = () =>
    createShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 40, height: 30 },
        name: 'Box'
    });
const text = () =>
    createShape({ type: 'text', position: { x: 0, y: 40 }, value: 'a', fontSize: 20 });
const property = (key: string) => SHAPE_PROPERTIES.find((item) => item.key === key)!;

describe('applyProperty()', () => {
    it('ignores values of the wrong type or out of range', () => {
        const shape = rect();

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
    });

    it('never leaves a text shape empty or without a size', () => {
        const label = text();

        applyProperty(property('text'), label, '  ');
        applyProperty(property('fontSize'), label, 0);

        expect(label).toMatchObject({ value: 'a', fontSize: 20 });
    });

    it('does not write read-only properties', () => {
        const shape = rect();

        applyProperty(property('width'), shape, 99);

        expect(shape).toMatchObject({ size: { width: 40 } });
    });
});
