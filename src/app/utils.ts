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

export function getBBox(shape: Partial<Shape>): Box | undefined {
  if (!shape) {
    return undefined;
  }

  if (shape.type === 'line') {
    //@ts-ignore
    return { topLeft: { x: shape.x1, y: shape.y1 }, bottomRight: { x: shape.x2, y: shape.y2 } };
  }

  return {
    topLeft: shape.position as Point,
    bottomRight: {
      x: (shape.position as Point).x + (shape as Point).size.width,
      y: (shape.position as Point).y + (shape as Point).size.height
    }
  };
}

export function pointInRectangle(p: Point, shape: Partial<Shape>): boolean {
  const box = getBBox(shape);

  if (!box) {
    return false;
  }

  const horizontalFit = box.topLeft!.x <= p.x && p.x <= box.bottomRight.x;
  const verticalFit = box.topLeft!.y <= p.y && p.y <= box.bottomRight.y;

  return horizontalFit && verticalFit;
}

export function overlaps(source?: Box, target?: Box) {
  if (!source || !target) {
    return false;
  }

  if (source.bottomRight.x < target.topLeft.x || source.bottomRight.y < target.topLeft.y) {
    return false;
  }

  if (target.bottomRight.x < source.topLeft.x || target.bottomRight.y < source.topLeft.y) {
    return false;
  }

  return true;
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
