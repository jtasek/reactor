import {
    CURVE_STEPS,
    insidePolygon,
    mapPathPoints,
    pathData,
    pathOutline
} from 'src/app/pathGeometry';
import { getPathBoundingBox } from 'src/app/utils';
import { hitTestShape } from 'src/app/geometry';
import { createShape } from 'src/app/factories';
import { isClosedShape } from 'src/app/utils';
import { SHAPE_PROPERTIES } from 'src/app/properties';
import type { Shape } from 'src/app/types';

const corner = { x: 0, y: 0 };
const curve = [
    { x: 0, y: 0, out: { x: 0, y: -40 } },
    { x: 100, y: 0, in: { x: 100, y: -40 } }
];

describe('paths', () => {
    it('draw straight segments, curves where a handle bends them, and close', () => {
        expect(pathData({ points: [corner, { x: 10, y: 0 }, { x: 10, y: 10 }] })).toBe(
            'M0 0L10 0L10 10'
        );
        expect(pathData({ points: curve, closed: true })).toBe('M0 0C0 -40 100 -40 100 0Z');
        expect(pathData({ points: [] })).toBe('');
    });

    it('measure the curve, not the handles', () => {
        const box = getPathBoundingBox({ points: curve });

        expect(pathOutline({ points: curve })).toHaveLength(CURVE_STEPS + 1);
        expect(box.topLeft.y).toBeCloseTo(-30);
        expect(box.width).toBe(100);
    });

    it('move their handles with their points', () => {
        expect(mapPathPoints(curve, ({ x, y }) => ({ x: x + 5, y }))).toEqual([
            { x: 5, y: 0, out: { x: 5, y: -40 } },
            { x: 105, y: 0, in: { x: 105, y: -40 } }
        ]);
    });

    it('are pressed inside only when closed', () => {
        const square = [corner, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
        const shape = (closed: boolean) =>
            createShape({
                type: 'path',
                points: square,
                ...(closed && { closed: true as const }),
                order: 'a0',
                name: 'path'
            });

        expect(insidePolygon({ x: 50, y: 50 }, square)).toBe(true);
        expect(hitTestShape(shape(true), { x: 50, y: 50 }, 2)).toBe(true);
        expect(hitTestShape(shape(false), { x: 50, y: 50 }, 2)).toBe(false);
        expect(hitTestShape(shape(true), { x: 2, y: 50 }, 3)).toBe(true);
    });

    it('take a fill only once closed', () => {
        const fill = SHAPE_PROPERTIES.find((property) => property.key === 'fill')!;
        const open = { type: 'path', points: [], fill: '#ff0000' } as unknown as Shape;
        const closed = { ...open, closed: true } as Shape;

        expect(isClosedShape(open)).toBe(false);
        expect(isClosedShape(closed)).toBe(true);
        expect(fill.read(open, undefined!)).toBeUndefined();
        expect(fill.read(closed, undefined!)).toBe('#ff0000');
    });
});
