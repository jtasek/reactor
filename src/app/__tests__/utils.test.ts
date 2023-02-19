import { Box, Point, Shape } from '../types';
import {
  Ellipse,
  getDistance,
  isCircleInBox,
  isEllipseInBox,
  isRectangleInBox,
  overlaps,
  isPointInBox
} from '../utils';

describe('utils', () => {
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
        topLeft: { x: 3, y: 3 },
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
    const ellipse: Ellipse = {
      center: { x: 5, y: 5 },
      radiusX: 2,
      radiusY: 3
    };
    const box: Box = {
      topLeft: { x: 2, y: 2 },
      bottomRight: { x: 8, y: 8 }
    };

    test('Ellipse inside box should return true', () => {
      expect(isEllipseInBox(ellipse, box)).toBe(true);
    });

    test('Ellipse outside box should return false', () => {
      const ellipse2: Ellipse = {
        center: { x: 10, y: 10 },
        radiusX: 2,
        radiusY: 3
      };
      expect(isEllipseInBox(ellipse2, box)).toBe(false);
    });

    test('Ellipse partially outside box should return false', () => {
      const ellipse3: Ellipse = {
        center: { x: 6, y: 6 },
        radiusX: 3,
        radiusY: 4
      };
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
      const target: Box = { topLeft: { x: 200, y: 100 }, bottomRight: { x: 300, y: 200300 } };

      const actual = overlaps(source, target);

      expect(actual).toBeFalsy();
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
});
