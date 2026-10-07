import { readClipboard, writeClipboard } from 'src/app/clipboard';
import { createShape } from 'src/app/factories';
import { SHAPE_PROPERTIES, applyProperty } from 'src/app/properties';
import { readEntity } from 'src/app/services/documentStorage';
import type { Shape, Text } from 'src/app/types';

const text = (fontColor?: string) => {
    const shape = createShape({
        type: 'text',
        name: 'text-1',
        position: { x: 0, y: 20 },
        value: 'Hello',
        order: 'a0'
    }) as Text;

    return fontColor === undefined ? shape : { ...shape, fontColor };
};
const rectangle = createShape({
    type: 'rectangle',
    name: 'rectangle-1',
    position: { x: 0, y: 0 },
    size: { width: 10, height: 10 },
    order: 'a0'
});

const fontColorProperty = SHAPE_PROPERTIES.find((property) => property.key === 'fontColor')!;

const saved = (shape: Shape) =>
    JSON.parse(JSON.stringify({ ...shape, selected: undefined, active: undefined }));

describe('font color', () => {
    it('is a color edited in the text section, for texts only', () => {
        const shape = text();

        expect(fontColorProperty).toMatchObject({ group: 'Text', kind: 'color' });
        expect(fontColorProperty.read(shape, {} as never)).toBe('');
        expect(fontColorProperty.read(rectangle, {} as never)).toBeUndefined();

        applyProperty(fontColorProperty, shape, '#aa0000');
        expect(shape.fontColor).toBe('#aa0000');

        applyProperty(fontColorProperty, shape, 'blue');
        expect(shape.fontColor).toBe('#aa0000');

        applyProperty(fontColorProperty, shape, '');
        expect(shape).not.toHaveProperty('fontColor');
    });

    it('is saved and read back, and an invalid one makes the text invalid', () => {
        expect(readEntity('shapes', saved(text('#123456')))).toMatchObject({
            fontColor: '#123456'
        });
        expect(readEntity('shapes', saved(text()))).not.toHaveProperty('fontColor');
        expect(() => readEntity('shapes', saved(text('url(#x)')))).toThrow();
    });

    it('is copied and pasted with the text', () => {
        const [copied] = readClipboard(writeClipboard([text('#00ff00')])).shapes;

        expect(copied).toMatchObject({ fontColor: '#00ff00' });
    });
});
