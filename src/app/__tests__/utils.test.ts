import { getDistance, pointInRectangle } from '../utils';

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
});
