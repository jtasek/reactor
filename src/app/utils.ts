import { Box, Point, Shape, Vector } from './types';

export function stringifyPath(path: Point[]): string {
  return path.map((point: Point) => `${point.x}, ${point.y}`).join(' ');
}

export function getRandomNumber(max: number): number {
  return Math.floor(Math.random() * max);
}

export function getRandomColor(): string {
  return `rgb(${getRandomNumber(255)}, ${getRandomNumber(255)}, ${getRandomNumber(255)})`;
}

export function getDistance(p1: Point, p2: Point): number {
  return Math.hypot(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
}

export function getBBox(shape: Partial<Shape>) {
  return { point: shape.position, size: shape.size };
}

export function pointInRectangle(p: Point, shape: Partial<Shape>): boolean {
  const { point, size } = getBBox(shape);

  const horizontalFit = point!.x <= p.x && p.x <= point!.x + size.width;
  const verticalFit = point!.y <= p.y && p.y <= point!.y + size.height;

  return horizontalFit && verticalFit;
}

export function overlaps(source: Box, target: Box) {
  if (source.bottomRight.x < target.topLeft.x || source.bottomRight.y < target.topLeft.y) {
    return false;
  }
}

export function getPropValue(prop: any): unknown {
  if (!prop) {
    return;
  }

  if (typeof prop === 'object') {
    if (prop instanceof Array) {
      return `${prop.length} item(s)`;
    }
    return '[object]';
  }

  if (typeof prop === 'function') {
    return '[function]';
  }

  return prop.toString();
}

export function vector(p1: Point, p2: Point): Vector {
  return {
    x: p2.x - p1.x,
    y: p2.y - p1.y
  };
}

export function dot(u: Point, v: Point): number {
  return u.x * v.x + u.y * v.y;
}
