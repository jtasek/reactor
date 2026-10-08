import { measuresBetween } from 'src/app/measures';
import type { Box } from 'src/app/types';

const box = (left: number, top: number, width: number, height: number): Box => ({
    topLeft: { x: left, y: top },
    bottomRight: { x: left + width, y: top + height },
    width,
    height
});

describe('the measures between the selection and another shape', () => {
    it('is the gap to a shape beside it, midway across their overlap', () => {
        expect(measuresBetween(box(0, 0, 40, 40), box(100, 20, 40, 40))).toEqual([
            { axis: 'x', from: { x: 40, y: 30 }, to: { x: 100, y: 30 } },
            { axis: 'y', from: { x: 20, y: 0 }, to: { x: 20, y: 20 } },
            { axis: 'y', from: { x: 20, y: 40 }, to: { x: 20, y: 60 } }
        ]);
    });

    it('is the gaps across and down to a shape apart on both axes, from the selection’s middle', () => {
        expect(measuresBetween(box(0, 0, 40, 40), box(100, 100, 20, 20))).toEqual([
            { axis: 'x', from: { x: 40, y: 20 }, to: { x: 100, y: 20 } },
            { axis: 'y', from: { x: 20, y: 40 }, to: { x: 20, y: 100 } }
        ]);
    });

    it('is the distances between the edges of a shape it is inside', () => {
        expect(measuresBetween(box(10, 10, 20, 20), box(0, 0, 100, 50))).toEqual([
            { axis: 'x', from: { x: 0, y: 20 }, to: { x: 10, y: 20 } },
            { axis: 'x', from: { x: 30, y: 20 }, to: { x: 100, y: 20 } },
            { axis: 'y', from: { x: 20, y: 0 }, to: { x: 20, y: 10 } },
            { axis: 'y', from: { x: 20, y: 30 }, to: { x: 20, y: 50 } }
        ]);
    });
});
