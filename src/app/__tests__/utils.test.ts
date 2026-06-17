import { Box, Document, Ellipse, Point, Shape } from '../types';
import {
    debounce,
    getDistance,
    isCircleInBox,
    isEllipseInBox,
    isRectangleInBox,
    overlaps,
    isPointInBox,
    boxCenter,
    rotatePoint,
    angleBetween,
    isShapeLocked
} from '../utils';

describe('utils', () => {
    describe('debounce()', () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it('invokes the function once after the delay, with the latest args', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 500);

            debounced('a');
            debounced('b');
            debounced('c');

            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(500);

            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('c');
        });

        it('restarts the timer on each call', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 500);

            debounced();
            vi.advanceTimersByTime(400);
            debounced();
            vi.advanceTimersByTime(400);

            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('getDistance()', () => {
        it('returns distance between two points', () => {
            const p1 = { x: 1, y: 1 };
            const p2 = { x: 10, y: 10 };
            const actual = getDistance(p1, p2);

            expect(actual).toBe(12.727922061357857);
        });
    });

    describe('isCircleInBox', () => {
        const center: Point = { x: 5, y: 5 };
        const r = 2;

        it('should return true if circle is contained in box', () => {
            const box: Box = {
                topLeft: { x: 0, y: 0 },
                bottomRight: { x: 10, y: 10 }
            };
            expect(isCircleInBox(center, r, box)).toBe(true);
        });

        it('should return false if circle is not contained in box', () => {
            const box: Box = {
                topLeft: { x: 0, y: 0 },
                bottomRight: { x: 4, y: 4 }
            };
            expect(isCircleInBox(center, r, box)).toBe(false);
        });

        it('should return false if circle center is outside box', () => {
            const box: Box = {
                topLeft: { x: 6, y: 6 },
                bottomRight: { x: 10, y: 10 }
            };
            expect(isCircleInBox(center, r, box)).toBe(false);
        });

        it('should return false if circle intersects box', () => {
            const box: Box = {
                topLeft: { x: 4, y: 4 },
                bottomRight: { x: 10, y: 10 }
            };
            expect(isCircleInBox(center, r, box)).toBe(false);
        });
    });

    describe('isRectangleInBox', () => {
        const box1: Box = {
            topLeft: { x: 2, y: 2 },
            bottomRight: { x: 6, y: 6 }
        };
        const box2: Box = {
            topLeft: { x: 3, y: 3 },
            bottomRight: { x: 5, y: 5 }
        };
        const box3: Box = {
            topLeft: { x: 4, y: 4 },
            bottomRight: { x: 8, y: 8 }
        };

        test('Box inside box should return true', () => {
            expect(isRectangleInBox(box2, box1)).toBe(true);
        });

        test('Box outside box should return false', () => {
            expect(isRectangleInBox(box3, box1)).toBe(false);
        });

        test('Box partially inside box should return false', () => {
            const box4: Box = {
                topLeft: { x: 1, y: 1 },
                bottomRight: { x: 4, y: 4 }
            };
            expect(isRectangleInBox(box4, box1)).toBe(false);
        });
    });

    describe('isEllipseInBox', () => {
        const ellipse = {
            position: { x: 5, y: 5 },
            radius: { x: 2, y: 3 }
        } as Ellipse;
        const box: Box = {
            topLeft: { x: 2, y: 2 },
            bottomRight: { x: 8, y: 8 }
        };

        test('Ellipse inside box should return true', () => {
            expect(isEllipseInBox(ellipse, box)).toBe(true);
        });

        test('Ellipse outside box should return false', () => {
            const ellipse2 = {
                position: { x: 10, y: 10 },
                radius: { x: 2, y: 3 }
            } as Ellipse;
            expect(isEllipseInBox(ellipse2, box)).toBe(false);
        });

        test('Ellipse partially outside box should return false', () => {
            const ellipse3 = {
                position: { x: 6, y: 6 },
                radius: { x: 3, y: 4 }
            } as Ellipse;
            expect(isEllipseInBox(ellipse3, box)).toBe(false);
        });
    });

    describe('isPointInBox()', () => {
        it('returns true when point is inside of rectangle', () => {
            const actual = isPointInBox(
                { x: 50, y: 50 },
                { position: { x: 1, y: 1 }, size: { width: 100, height: 100 } }
            );

            expect(actual).toBe(true);
        });

        it('returns false when point is outside of rectangle', () => {
            const actual = isPointInBox(
                { x: 1, y: 1 },
                { position: { x: 50, y: 50 }, size: { width: 100, height: 100 } }
            );

            expect(actual).toBe(false);
        });
    });

    describe('overlap()', () => {
        it('returns false when source is on the left from target', () => {
            const source: Box = { topLeft: { x: 100, y: 100 }, bottomRight: { x: 200, y: 200 } };
            const target: Box = { topLeft: { x: 250, y: 100 }, bottomRight: { x: 300, y: 300 } };

            const actual = overlaps(source, target);

            expect(actual).toBeFalsy();
        });

        it('returns true when source and target overlap', () => {
            const source: Box = { topLeft: { x: 100, y: 100 }, bottomRight: { x: 200, y: 200 } };
            const target: Box = { topLeft: { x: 150, y: 150 }, bottomRight: { x: 300, y: 300 } };

            const actual = overlaps(source, target);

            expect(actual).toBeTruthy();
        });
    });

    describe('isPointInBox()', () => {
        it('returns true when point is withing the box boundaries', () => {
            const point: Point = { x: 100, y: 100 };

            const shape: Partial<Shape> = {
                position: { x: 200, y: 300 },
                size: { height: 100, width: 100 }
            };

            const actual = isPointInBox(point, shape);

            expect(actual).toBe(false);
        });
    });

    describe('boxCenter()', () => {
        it('returns the geometric center of a box', () => {
            const box: Box = {
                topLeft: { x: 10, y: 20 },
                bottomRight: { x: 30, y: 60 },
                width: 20,
                height: 40
            };

            expect(boxCenter(box)).toEqual({ x: 20, y: 40 });
        });
    });

    describe('rotatePoint()', () => {
        const center: Point = { x: 0, y: 0 };

        it('returns the same point when rotating by 0 degrees', () => {
            expect(rotatePoint({ x: 10, y: 0 }, center, 0)).toEqual({ x: 10, y: 0 });
        });

        it('rotates 90 degrees clockwise around the center', () => {
            const result = rotatePoint({ x: 10, y: 0 }, center, 90);

            expect(result.x).toBeCloseTo(0);
            expect(result.y).toBeCloseTo(10);
        });

        it('rotates around a non-origin center', () => {
            const result = rotatePoint({ x: 5, y: 0 }, { x: 5, y: 5 }, 90);

            expect(result.x).toBeCloseTo(10);
            expect(result.y).toBeCloseTo(5);
        });
    });

    describe('angleBetween()', () => {
        const center: Point = { x: 0, y: 0 };

        it('measures 0 degrees along the +x axis', () => {
            expect(angleBetween(center, { x: 10, y: 0 })).toBeCloseTo(0);
        });

        it('measures 90 degrees straight down (y grows downward)', () => {
            expect(angleBetween(center, { x: 0, y: 10 })).toBeCloseTo(90);
        });

        it('measures -90 degrees straight up', () => {
            expect(angleBetween(center, { x: 0, y: -10 })).toBeCloseTo(-90);
        });
    });

    describe('isShapeLocked()', () => {
        const makeDocument = (overrides: Partial<Document> = {}): Document =>
            ({
                locked: false,
                shapes: { s1: { id: 's1', locked: false } as Shape },
                groupsIds: [],
                groups: {},
                layersIds: [],
                layers: {},
                ...overrides
            }) as unknown as Document;

        it('returns false for an unlocked shape', () => {
            expect(isShapeLocked(makeDocument(), 's1')).toBe(false);
        });

        it('returns false for an unknown shape', () => {
            expect(isShapeLocked(makeDocument(), 'missing')).toBe(false);
        });

        it('returns false when document is undefined', () => {
            expect(isShapeLocked(undefined, 's1')).toBe(false);
        });

        it('returns true when the shape itself is locked', () => {
            const document = makeDocument({
                shapes: { s1: { id: 's1', locked: true } as Shape }
            });

            expect(isShapeLocked(document, 's1')).toBe(true);
        });

        it('returns true when the document is locked', () => {
            expect(isShapeLocked(makeDocument({ locked: true }), 's1')).toBe(true);
        });

        it('returns true when the shape is in a locked group', () => {
            const document = makeDocument({
                groupsIds: ['g1'],
                groups: { g1: { id: 'g1', locked: true, shapesIds: ['s1'] } } as never
            });

            expect(isShapeLocked(document, 's1')).toBe(true);
        });

        it('returns true when the shape is in a locked layer', () => {
            const document = makeDocument({
                layersIds: ['l1'],
                layers: { l1: { id: 'l1', locked: true, shapesIds: ['s1'] } } as never
            });

            expect(isShapeLocked(document, 's1')).toBe(true);
        });

        it('returns false when the containing group is not locked', () => {
            const document = makeDocument({
                groupsIds: ['g1'],
                groups: { g1: { id: 'g1', locked: false, shapesIds: ['s1'] } } as never
            });

            expect(isShapeLocked(document, 's1')).toBe(false);
        });
    });
});
