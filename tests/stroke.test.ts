import { readClipboard, writeClipboard } from 'src/app/clipboard';
import { createShape } from 'src/app/factories';
import { SHAPE_PROPERTIES, applyProperty } from 'src/app/properties';
import { readEntity } from 'src/app/services/documentStorage';
import type { Shape, ShapeInput } from 'src/app/types';

const named = (input: ShapeInput, stroke?: string): Shape => {
    const shape = createShape({ ...input, name: `${input.type}-1`, order: 'a0' });

    return stroke === undefined ? shape : { ...shape, stroke };
};

const rectangle = (stroke?: string) =>
    named(
        { type: 'rectangle', position: { x: 0, y: 0 }, size: { width: 100, height: 40 } },
        stroke
    );
const line = named({ type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } });
const text = named({ type: 'text', position: { x: 0, y: 0 }, value: 'a' });

const strokeProperty = SHAPE_PROPERTIES.find((property) => property.key === 'stroke')!;

const saved = (shape: Shape) =>
    JSON.parse(JSON.stringify({ ...shape, selected: undefined, active: undefined }));

describe('stroke', () => {
    it('is a color edited in the style section, for shapes drawn with an outline', () => {
        const shape = rectangle();

        expect(strokeProperty).toMatchObject({ group: 'Style', kind: 'color' });
        expect(strokeProperty.read(shape, {} as never)).toBe('');
        expect(strokeProperty.read(line, {} as never)).toBe('');
        expect(strokeProperty.read(text, {} as never)).toBeUndefined();

        applyProperty(strokeProperty, shape, '#ff8800');
        expect(shape.stroke).toBe('#ff8800');
        expect(strokeProperty.read(shape, {} as never)).toBe('#ff8800');

        applyProperty(strokeProperty, shape, 'not a color');
        expect(shape.stroke).toBe('#ff8800');

        applyProperty(strokeProperty, shape, '');
        expect(shape).not.toHaveProperty('stroke');
    });

    it('is saved and read back, and an invalid one makes the shape invalid', () => {
        expect(readEntity('shapes', saved(rectangle('#336699')))).toMatchObject({
            stroke: '#336699'
        });
        expect(readEntity('shapes', saved(rectangle()))).not.toHaveProperty('stroke');
        expect(() => readEntity('shapes', saved(rectangle('red; display: none')))).toThrow();
    });

    it('is dropped from a shape without an outline when read', () => {
        const stroked = { ...text, stroke: '#ff0000' };

        expect(readEntity('shapes', saved(stroked))).not.toHaveProperty('stroke');
        expect(readClipboard(writeClipboard([stroked])).shapes[0]).not.toHaveProperty('stroke');
    });

    it('is copied and pasted with the shape', () => {
        const [copied] = readClipboard(writeClipboard([rectangle('#00aa55')])).shapes;

        expect(copied).toMatchObject({ stroke: '#00aa55' });
    });
});
