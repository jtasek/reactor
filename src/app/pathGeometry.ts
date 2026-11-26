import type { Path, PathPoint, Point } from './types';

/** How many straight pieces stand for one curved segment where a path is measured. */
export const CURVE_STEPS = 16;

/** Each point of a path and its handles, moved by `move`. */
export const mapPathPoints = (
    points: readonly PathPoint[],
    move: (point: Point) => Point
): PathPoint[] =>
    points.map(({ x, y, in: before, out: after }) => ({
        ...move({ x, y }),
        ...(before && { in: move(before) }),
        ...(after && { out: move(after) })
    }));

type Segment = [PathPoint, PathPoint];

const segments = ({ points, closed }: Pick<Path, 'points' | 'closed'>): Segment[] => {
    const pairs = points.slice(1).map((point, index): Segment => [points[index], point]);

    return closed && points.length > 2 ? [...pairs, [points.at(-1)!, points[0]]] : pairs;
};

const curved = ([from, to]: Segment) => Boolean(from.out || to.in);

/** The path as SVG path data: straight segments, or cubic curves where a handle bends them. */
export function pathData(path: Pick<Path, 'points' | 'closed'>): string {
    const [first] = path.points;

    if (!first) {
        return '';
    }

    const drawn = segments(path).map((segment) => {
        const [from, to] = segment;

        if (!curved(segment)) {
            return `L${to.x} ${to.y}`;
        }
        const a = from.out ?? from;
        const b = to.in ?? to;

        return `C${a.x} ${a.y} ${b.x} ${b.y} ${to.x} ${to.y}`;
    });

    return `M${first.x} ${first.y}${drawn.join('')}${path.closed ? 'Z' : ''}`;
}

const cubic = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
    const u = 1 - t;

    return {
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    };
};

/** The path as straight pieces, curves flattened, for measuring and hitting it. */
export function pathOutline(path: Pick<Path, 'points' | 'closed'>): Point[] {
    const [first] = path.points;

    if (!first) {
        return [];
    }

    return [
        { x: first.x, y: first.y },
        ...segments(path).flatMap((segment) => {
            const [from, to] = segment;

            if (!curved(segment)) {
                return [{ x: to.x, y: to.y }];
            }

            return Array.from({ length: CURVE_STEPS }, (_, step) =>
                cubic(from, from.out ?? from, to.in ?? to, to, (step + 1) / CURVE_STEPS)
            );
        })
    ];
}

/** Whether `point` is inside the polygon `outline`, by the even-odd rule a fill uses. */
export function insidePolygon(point: Point, outline: readonly Point[]): boolean {
    let inside = false;

    for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
        const a = outline[index];
        const b = outline[previous];

        if (
            a.y > point.y !== b.y > point.y &&
            point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
        ) {
            inside = !inside;
        }
    }

    return inside;
}
