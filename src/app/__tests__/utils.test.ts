import { Box, Point, Rectangle, Shape } from '../types';
import { getDistance, overlaps, pointInRectangle } from '../utils';

describe('utils', () => {
  describe('getDistance()', () => {
    it('returns distance between two points', () => {
      const p1 = { x: 1, y: 1 };
      const p2 = { x: 10, y: 10 };
      const actual = getDistance(p1, p2);

      expect(actual).toBe(12.727922061357857);
    });
  });

  describe('pointInRectangle()', () => {
    it('returns true when point is inside of rectangle', () => {
      const actual = pointInRectangle(
        { x: 50, y: 50 },
        { p: { x: 1, y: 1 }, size: { width: 100, height: 100 } }
      );

      expect(actual).toBe(true);
    });

    it('returns false when point is outside of rectangle', () => {
      const actual = pointInRectangle(
        { x: 1, y: 1 },
        { p: { x: 50, y: 50 }, size: { width: 100, height: 100 } }
      );

      expect(actual).toBe(false);
    });
  });

  describe('overlap()', () => {
    it('returns false when source is on the left from target', () => {
      const source: Box = { topLeft: { x: 100, y: 100 }, bottomRight: { x: 200, y: 200 } };
      const target: Box = { topLeft: { x: 200, y: 100 }, bottomRight: { x: 300, y: 200300 } };

      const actual = overlaps(source, target);

      expect(actual).toBeFalsy();
    });
  });

  describe('pointInRect()', () => {
    it('returns true when point is withing the box boundaries', () => {
      const point: Point = { x: 100, y: 100 };

      const shape: Partial<Shape> = {
        position: { x: 200, y: 300 },
        size: { height: 100, width: 100 }
      };

      const actual = pointInRectangle(point, shape);

      expect(actual).toBe(false);
    });
  });
});
