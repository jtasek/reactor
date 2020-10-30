import { Point, Rectangle, Vector } from './types';

export const stringifyPath = (path: Point[]): string => {
  return path.map((point: Point) => `${point.x}, ${point.y}`).join(' ');
};

export function getRandomNumber(max: number): number {
  return Math.floor(Math.random() * max);
}

export function getRandomColor(): string {
  return `rgb(${getRandomNumber(255)}, ${getRandomNumber(255)}, ${getRandomNumber(255)})`;
}

export function getDistance(p1: Point, p2: Point): number {
  return Math.hypot(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
}

export function pointInRectangle(p: Point, rect: Rectangle): boolean {
  const horizontalFit = rect.p.x <= p.x && p.x <= rect.p.x + rect.size.width;
  const verticalFit = rect.p.y <= p.y && p.y <= rect.p.y + rect.size.height;

  return horizontalFit && verticalFit;
}

export function getPropValue(prop: any): unknown {
  // console.log(typeof prop)
  if (typeof prop === 'object') {
    if (prop instanceof Array) {
      return prop.length;
    }
    return '[object]';
  } else if (typeof prop === 'function') {
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
