import { readClipboard, writeClipboard } from 'src/app/clipboard';
import { createShape } from 'src/app/factories';
import { SHAPE_PROPERTIES, applyProperty } from 'src/app/properties';
import { readEntity } from 'src/app/services/documentStorage';
import type { Rectangle } from 'src/app/types';

const rectangle = (opacity?: number) => {
    const shape = createShape({
        type: 'rectangle',
        name: 'rectangle-1',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 40 },
        order: 'a0'
    }) as Rectangle;

    return opacity === undefined ? shape : { ...shape, opacity };
};

const opacityProperty = SHAPE_PROPERTIES.find((property) => property.key === 'opacity')!;

const saved = (shape: Rectangle) =>
    JSON.parse(JSON.stringify({ ...shape, selected: undefined, active: undefined }));

describe('opacity', () => {
    it('is edited in the inspector as a percentage, from clear to opaque', () => {
        const shape = rectangle();

        expect(opacityProperty.group).toBe('Style');
        expect(opacityProperty.read(shape, {} as never)).toBe(100);

        applyProperty(opacityProperty, shape, 40);
        expect(shape.opacity).toBe(0.4);
        expect(opacityProperty.read(shape, {} as never)).toBe(40);

        applyProperty(opacityProperty, shape, 150);
        expect(shape.opacity).toBe(1);

        applyProperty(opacityProperty, shape, -5);
        expect(shape.opacity).toBe(0);
    });

    it('is saved and read back, and an invalid one makes the shape invalid', () => {
        expect(readEntity('shapes', saved(rectangle(0.4)))).toMatchObject({
            opacity: 0.4
        });
        expect(readEntity('shapes', saved(rectangle()))).not.toHaveProperty('opacity');
        expect(() => readEntity('shapes', saved(rectangle(1.5)))).toThrow();
    });

    it('is copied and pasted with the shape', () => {
        const [copied] = readClipboard(writeClipboard([rectangle(0.25)])).shapes;

        expect(copied).toMatchObject({ opacity: 0.25 });
    });
});
