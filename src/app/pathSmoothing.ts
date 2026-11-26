import type { PathPoint, Point } from './types';
import type { Smoothing } from './smoothingSetting';

/**
 * Per level, in screen pixels: how far along the stroke a point is averaged with its
 * neighbours, and how far the smoothed stroke may then stray from those averaged points.
 * Jitter is small, so a stroke's real corners, further apart than `reach`, stay sharp.
 */
export const SMOOTHING_LEVELS = {
    low: { reach: 10, tolerance: 2 },
    high: { reach: 24, tolerance: 6 }
};

const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Each point averaged with the neighbours within `reach` along the stroke, as many
 * on each side so the stroke doesn't drift; the ends stay put.
 */
export function average(points: readonly Point[], reach: number): Point[] {
    return points.map((point, index) => {
        let count = 0;

        for (let before = 0, after = 0; ; count++) {
            const previous = points[index - count - 1];
            const next = points[index + count + 1];

            if (!previous || !next) {
                break;
            }
            before += gap(previous, points[index - count]);
            after += gap(next, points[index + count]);

            if (before > reach || after > reach) {
                break;
            }
        }
        const near = points.slice(index - count, index + count + 1);

        return {
            x: near.reduce((sum, { x }) => sum + x, 0) / near.length,
            y: near.reduce((sum, { y }) => sum + y, 0) / near.length
        };
    });
}

/** How far `point` is from the line through `a` and `b`. */
const distanceToLine = (point: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const x = point.x - a.x;
    const y = point.y - a.y;

    return Math.abs(x * dy - y * dx) / Math.hypot(dx, dy) || Math.hypot(x, y);
};

/** The fewest points that keep the line within `tolerance` of every point (Ramer–Douglas–Peucker). */
export function simplify(points: readonly Point[], tolerance: number): Point[] {
    const last = points.length - 1;
    let farthest = 0;
    let distance = tolerance;

    for (let index = 1; index < last; index++) {
        const away = distanceToLine(points[index], points[0], points[last]);

        if (away > distance) {
            farthest = index;
            distance = away;
        }
    }

    return farthest
        ? [
              ...simplify(points.slice(0, farthest + 1), tolerance).slice(0, -1),
              ...simplify(points.slice(farthest), tolerance)
          ]
        : points.slice(0, 1).concat(points.slice(1).slice(-1));
}

const round = ({ x, y }: Point): Point => ({
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100
});

/**
 * A hand-drawn stroke with its jitter taken out: averaged, cut to the fewest points,
 * and joined by curves through each one, whose handles reach a third of the way to
 * the neighbouring points so they never overshoot. `scale` is the camera's, so a
 * level smooths the same on screen at any zoom.
 */
export function smoothStroke(
    points: readonly Point[],
    smoothing: Smoothing,
    scale: number
): PathPoint[] {
    if (smoothing === 'off') {
        return points.map(round);
    }
    const { reach, tolerance } = SMOOTHING_LEVELS[smoothing];
    const kept = simplify(average(points, reach / scale), tolerance / scale);

    return kept.map((point, index) => {
        const before = kept[index - 1];
        const after = kept[index + 1];

        if (!before || !after) {
            return round(point);
        }
        const dx = after.x - before.x;
        const dy = after.y - before.y;
        const length = Math.hypot(dx, dy) || 1;
        const handle = (to: Point, sign: number) => {
            const along = (sign * gap(to, point)) / 3 / length;

            return round({ x: point.x + dx * along, y: point.y + dy * along });
        };

        return { ...round(point), in: handle(before, -1), out: handle(after, 1) };
    });
}
