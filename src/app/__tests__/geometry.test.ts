import { createShape } from '../factories';
import { hitTestShape, hitTolerance, shapeIntersectsBox } from '../geometry';

describe('geometry', () => {
    describe('hitTolerance()', () => {
        it('adds half the stroke to a slop that stays constant on screen', () => {
            expect(hitTolerance(1)).toBe(5);
            expect(hitTolerance(4)).toBe(2);
            expect(hitTolerance(0.5)).toBe(9);
        });
    });

    describe('hitTestShape()', () => {
        it('treats a zero-length line as a point', () => {
            const dot = createShape({
                type: 'line',
                start: { x: 10, y: 10 },
                end: { x: 10, y: 10 },
                order: 'a0'
            });

            expect(hitTestShape(dot, { x: 13, y: 14 }, 5)).toBe(true);
            expect(hitTestShape(dot, { x: 14, y: 14 }, 5)).toBe(false);
        });

        it('hits a single-point pen near that point and never an empty pen', () => {
            const single = createShape({ type: 'pen', points: [{ x: 10, y: 10 }], order: 'a0' });
            const empty = createShape({ type: 'pen', points: [], order: 'a0' });

            expect(hitTestShape(single, { x: 10, y: 14 }, 5)).toBe(true);
            expect(hitTestShape(empty, { x: 0, y: 0 }, 5)).toBe(false);
        });

        it('hits a flat ellipse along its stroke', () => {
            const flat = createShape({
                type: 'ellipse',
                position: { x: 50, y: 50 },
                radius: { x: 40, y: 0 },
                order: 'a0'
            });

            expect(hitTestShape(flat, { x: 50, y: 53 }, 5)).toBe(true);
            expect(hitTestShape(flat, { x: 50, y: 56 }, 5)).toBe(false);
        });

        it('tests rotated shapes in their own frame', () => {
            const shape = { type: 'rectangle' as const, position: { x: 0, y: 0 }, order: 'a0' };
            const halfTurn = createShape({
                ...shape,
                size: { width: 40, height: 20 },
                rotation: 180
            });
            const quarterTurn = createShape({
                ...shape,
                size: { width: 40, height: 20 },
                rotation: 90
            });

            // A half turn about the center (20, 10) covers the same area.
            expect(hitTestShape(halfTurn, { x: 38, y: 18 }, 0)).toBe(true);
            // A quarter turn covers x 10–30, y -10–30.
            expect(hitTestShape(quarterTurn, { x: 20, y: 28 }, 0)).toBe(true);
            expect(hitTestShape(quarterTurn, { x: 38, y: 10 }, 0)).toBe(false);
        });
    });

    describe('shapeIntersectsBox()', () => {
        it('matches plain box overlap for unrotated shapes, including touching edges', () => {
            const square = createShape({
                type: 'rectangle',
                position: { x: 0, y: 0 },
                size: { width: 10, height: 10 },
                order: 'a0'
            });

            expect(
                shapeIntersectsBox(square, {
                    topLeft: { x: 10, y: 10 },
                    bottomRight: { x: 20, y: 20 }
                })
            ).toBe(true);
            expect(
                shapeIntersectsBox(square, {
                    topLeft: { x: 11, y: 0 },
                    bottomRight: { x: 20, y: 5 }
                })
            ).toBe(false);
        });

        it('ignores the empty corners of a rotated shape', () => {
            // A 20×20 square turned 45° about (10, 10) is a diamond reaching ±14.1.
            const diamond = createShape({
                type: 'rectangle',
                position: { x: 0, y: 0 },
                size: { width: 20, height: 20 },
                rotation: 45,
                order: 'a0'
            });

            expect(
                shapeIntersectsBox(diamond, {
                    topLeft: { x: -4, y: -4 },
                    bottomRight: { x: 0, y: 0 }
                })
            ).toBe(false);
            expect(
                shapeIntersectsBox(diamond, {
                    topLeft: { x: 8, y: -4 },
                    bottomRight: { x: 12, y: 0 }
                })
            ).toBe(true);
        });
    });
});
