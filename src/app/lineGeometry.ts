import type { Point } from './types';

/** The arrowhead's sides, in canvas units, and their angle from the line, in degrees. */
export const ARROW_HEAD = { length: 12, angle: 30 };

/** The arrowhead at `end`, as the points of an open polyline: one side, the tip, the other side. */
export function arrowHeadPoints(start: Point, end: Point): Point[] {
    const direction = Math.atan2(end.y - start.y, end.x - start.x);
    const spread = (ARROW_HEAD.angle * Math.PI) / 180;
    const side = (angle: number) => ({
        x: end.x - ARROW_HEAD.length * Math.cos(angle),
        y: end.y - ARROW_HEAD.length * Math.sin(angle)
    });

    return [side(direction - spread), end, side(direction + spread)];
}

/** `end` moved to the nearest 45° from `start`, as far from it as before. */
export function snapToEighth(start: Point, end: Point): Point {
    const step = Math.PI / 4;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const angle = Math.round(Math.atan2(end.y - start.y, end.x - start.x) / step) * step;

    return {
        x: start.x + Math.round(length * Math.cos(angle)),
        y: start.y + Math.round(length * Math.sin(angle))
    };
}
