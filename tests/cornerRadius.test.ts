import { cornerRadiusAfterDrag, limitCornerRadius } from 'src/app/geometry';
import { createShape } from 'src/app/factories';
import { SHAPE_PROPERTIES, applyProperty } from 'src/app/properties';
import { readShapeGeometry } from 'src/app/services/documentStorage';
import type { Rectangle } from 'src/app/types';
import { shapeGeometry } from 'src/app/utils';
import { createTestStore } from './support/store';

/** A 100 by 40 rectangle at (0, 0). */
const rectangle = (fields: Partial<Rectangle> = {}) =>
    createShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 40 },
        order: 'a0',
        ...fields
    }) as Rectangle;

const radiusProperty = SHAPE_PROPERTIES.find((property) => property.key === 'cornerRadius')!;

describe('corner radius', () => {
    it('is at most half the shorter side, and never below none', () => {
        expect(limitCornerRadius({ width: 100, height: 40 }, 12)).toBe(12);
        expect(limitCornerRadius({ width: 100, height: 40 }, 50)).toBe(20);
        expect(limitCornerRadius({ width: 100, height: 40 }, -5)).toBe(0);
    });

    it('grows by how far its handle is dragged in along the diagonal', () => {
        const drag = (from: [number, number], to: [number, number], fields = {}) =>
            cornerRadiusAfterDrag(
                rectangle(fields),
                { x: from[0], y: from[1] },
                { x: to[0], y: to[1] }
            );

        expect(drag([12, 12], [18, 24])).toBe(9);
        expect(drag([12, 12], [102, 102])).toBe(20);
        expect(drag([12, 12], [0, 0])).toBe(0);
        // From the radius it is drawn with, not the one stored beyond it.
        expect(drag([20, 20], [10, 10], { cornerRadius: 30 })).toBe(10);
    });

    it('follows the handle in the rectangle’s turned frame', () => {
        // Turned half a turn, its top left corner is at the bottom right, so in is up and left.
        const turned = rectangle({ rotation: 180 });

        expect(cornerRadiusAfterDrag(turned, { x: 88, y: 28 }, { x: 78, y: 18 })).toBeCloseTo(10);
    });

    it('is edited in the inspector for rectangles only, as drawn', () => {
        const shape = rectangle({ cornerRadius: 30 });
        const circle = createShape({
            type: 'circle',
            position: { x: 0, y: 0 },
            radius: 5,
            order: 'a0'
        });

        expect(radiusProperty.read(shape, {} as never)).toBe(20);
        expect(radiusProperty.read(circle, {} as never)).toBeUndefined();

        applyProperty(radiusProperty, shape, 8);
        expect(shape.cornerRadius).toBe(8);

        applyProperty(radiusProperty, shape, 60);
        expect(shape.cornerRadius).toBe(20);
    });

    it('is saved, read back and copied with the rectangle', () => {
        const shape = rectangle({ cornerRadius: 6 });

        expect(shapeGeometry(shape)).toMatchObject({ cornerRadius: 6 });
        expect(readShapeGeometry({ ...shapeGeometry(shape) })).toMatchObject({ cornerRadius: 6 });
        expect(readShapeGeometry({ ...shapeGeometry(rectangle()) })).not.toHaveProperty(
            'cornerRadius'
        );
        expect(() => readShapeGeometry({ ...shapeGeometry(shape), cornerRadius: -1 })).toThrow();
    });

    it('is dragged by its handle live, and a canceled drag leaves it as it was', () => {
        const { store } = createTestStore();
        const { events } = store.actions;

        store.actions.addShape({
            type: 'rectangle',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 40 }
        });
        const shapeId = store.state.currentDocument.shapesIds[0];
        const shape = () => store.state.currentDocument.shapes[shapeId] as Rectangle;
        const handle = { shapeId, type: 'radius' as const };

        events.beginGesture({ pointerId: 1, position: { x: 4, y: 4 }, handle });
        expect(store.state.events.pointer.gesture).toMatchObject({ kind: 'rounding', shapeId });

        events.movePointer({ pointerId: 1, position: { x: 10, y: 14 } });
        expect(shape().cornerRadius).toBe(8);

        events.cancelGesture();
        expect(shape().cornerRadius).toBeUndefined();

        events.beginGesture({ pointerId: 1, position: { x: 4, y: 4 }, handle });
        events.endGesture({ pointerId: 1, position: { x: 6, y: 10 } });
        expect(shape().cornerRadius).toBe(4);

        store.actions.lockShape(shapeId);
        events.beginGesture({ pointerId: 1, position: { x: 8, y: 8 }, handle });
        events.endGesture({ pointerId: 1, position: { x: 20, y: 20 } });
        expect(shape().cornerRadius).toBe(4);
    });
});
