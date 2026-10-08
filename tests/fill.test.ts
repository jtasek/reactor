import { readClipboard, writeClipboard } from 'src/app/clipboard';
import { createShape } from 'src/app/factories';
import { SHAPE_PROPERTIES, applyProperty } from 'src/app/properties';
import { readEntity } from 'src/app/services/documentStorage';
import type { Shape, ShapeInput } from 'src/app/types';

const named = (input: ShapeInput, fill?: string): Shape => {
    const shape = createShape({ ...input, name: `${input.type}-1`, order: 'a0' });

    return fill === undefined ? shape : { ...shape, fill };
};

const rectangle = (fill?: string) =>
    named({ type: 'rectangle', position: { x: 0, y: 0 }, size: { width: 100, height: 40 } }, fill);
const line = named({ type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } });

const fillProperty = SHAPE_PROPERTIES.find((property) => property.key === 'fill')!;

const saved = (shape: Shape) =>
    JSON.parse(JSON.stringify({ ...shape, selected: undefined, active: undefined }));

describe('fill', () => {
    it('is a color edited in the style section, for closed shapes only', () => {
        const shape = rectangle();

        expect(fillProperty).toMatchObject({ group: 'Style', kind: 'color' });
        expect(fillProperty.read(shape, {} as never)).toBe('');
        expect(fillProperty.read(line, {} as never)).toBeUndefined();

        applyProperty(fillProperty, shape, '#ff8800');
        expect(shape.fill).toBe('#ff8800');
        expect(fillProperty.read(shape, {} as never)).toBe('#ff8800');

        applyProperty(fillProperty, shape, 'not a color');
        expect(shape.fill).toBe('#ff8800');

        applyProperty(fillProperty, shape, '');
        expect(shape).not.toHaveProperty('fill');
    });

    it('is saved and read back, and an invalid one makes the shape invalid', () => {
        expect(readEntity('shapes', saved(rectangle('#336699')))).toMatchObject({
            fill: '#336699'
        });
        expect(readEntity('shapes', saved(rectangle()))).not.toHaveProperty('fill');
        expect(() => readEntity('shapes', saved(rectangle('red; display: none')))).toThrow();
    });

    it('is dropped from a shape it does not fill when read', () => {
        const pen = named(
            {
                type: 'pen',
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 }
                ]
            },
            '#ff0000'
        );

        expect(readEntity('shapes', saved(pen))).not.toHaveProperty('fill');
        expect(readClipboard(writeClipboard([pen])).shapes[0]).not.toHaveProperty('fill');
    });

    it('is copied and pasted with the shape', () => {
        const [copied] = readClipboard(writeClipboard([rectangle('#00aa55')])).shapes;

        expect(copied).toMatchObject({ fill: '#00aa55' });
    });
});
