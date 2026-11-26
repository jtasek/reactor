import { average, simplify, smoothStroke } from 'src/app/pathSmoothing';
import { readSmoothing } from 'src/app/smoothingSetting';

const jittery = Array.from({ length: 50 }, (_, index) => ({
    x: index * 4,
    y: index % 2 ? 0.5 : -0.5
}));

describe('pencil smoothing', () => {
    it('keeps the hand-drawn points when off', () => {
        expect(smoothStroke(jittery, 'off', 1)).toEqual(jittery);
    });

    it('takes jitter within the tolerance out of a stroke', () => {
        expect(simplify(jittery, 2)).toEqual([jittery[0], jittery[49]]);
        expect(smoothStroke(jittery, 'low', 1)).toHaveLength(2);
    });

    it('keeps the corners that stray past the tolerance', () => {
        const v = [
            { x: 0, y: 0 },
            { x: 25, y: 26 },
            { x: 50, y: 50 },
            { x: 75, y: 24 },
            { x: 100, y: 0 }
        ];

        expect(simplify(v, 2)).toEqual([v[0], v[2], v[4]]);
    });

    it('averages each point with as many close neighbours on each side, and keeps the ends', () => {
        const zigzag = [0, 3, 0, 3, 0].map((y, index) => ({ x: index * 4, y }));

        expect(average(zigzag, 10)).toEqual([
            { x: 0, y: 0 },
            { x: 4, y: 1 },
            { x: 8, y: 1.2 },
            { x: 12, y: 1 },
            { x: 16, y: 0 }
        ]);
    });

    it('keeps corners further apart than the reach sharp', () => {
        const v = [
            { x: 0, y: 0 },
            { x: 50, y: 50 },
            { x: 100, y: 0 }
        ];

        expect(average(v, 24)).toEqual(v);
    });

    it('curves through each kept point, handles a third of the way towards its neighbours', () => {
        expect(
            smoothStroke(
                [
                    { x: 0, y: 0 },
                    { x: 30, y: 40 },
                    { x: 100, y: 0 }
                ],
                'high',
                1
            )
        ).toEqual([
            { x: 0, y: 0 },
            { x: 30, y: 40, in: { x: 13.33, y: 40 }, out: { x: 56.87, y: 40 } },
            { x: 100, y: 0 }
        ]);
    });

    it('smooths the same on screen at any zoom', () => {
        const bump = Array.from({ length: 9 }, (_, index) => ({
            x: index * 5,
            y: 1.5 * Math.sin((Math.PI * index) / 8)
        }));

        expect(smoothStroke(bump, 'low', 1)).toHaveLength(2);
        expect(smoothStroke(bump, 'low', 4).length).toBeGreaterThan(2);
    });

    it('reads a stored level, or falls back to the default', () => {
        expect(readSmoothing('high')).toBe('high');
        expect(readSmoothing('extreme')).toBe('low');
        expect(readSmoothing(undefined)).toBe('low');
    });
});
