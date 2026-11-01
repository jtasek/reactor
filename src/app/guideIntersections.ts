import type { Orientation, Point } from './types';

export type GuideOutline =
    | { kind: 'segment'; start: Point; end: Point }
    | { kind: 'arc'; center: Point; u: Point; v: Point; from: number; to: number };

const TAU = Math.PI * 2;
const EPSILON = 1e-7;

/** Crossings in surface pixels. Arcs retain exact ellipse geometry after affine transforms. */
export function guideIntersections(
    outlines: GuideOutline[],
    orientation: Orientation,
    at: number
): Point[] {
    const axis = orientation === 'vertical' ? 'x' : 'y';
    const points = outlines.flatMap((outline): Point[] => {
        if (outline.kind === 'segment') {
            const delta = outline.end[axis] - outline.start[axis];
            if (Math.abs(delta) < EPSILON) {
                return Math.abs(at - outline.start[axis]) < EPSILON
                    ? [outline.start, outline.end]
                    : [];
            }
            const t = (at - outline.start[axis]) / delta;
            if (t < -EPSILON || t > 1 + EPSILON) {
                return [];
            }

            return [
                {
                    x: outline.start.x + t * (outline.end.x - outline.start.x),
                    y: outline.start.y + t * (outline.end.y - outline.start.y)
                }
            ];
        }
        const radius = Math.hypot(outline.u[axis], outline.v[axis]);
        if (radius < EPSILON) {
            return [];
        }
        const ratio = (at - outline.center[axis]) / radius;
        if (Math.abs(ratio) > 1 + EPSILON) {
            return [];
        }
        const phase = Math.atan2(outline.v[axis], outline.u[axis]);
        const angle = Math.acos(Math.max(-1, Math.min(1, ratio)));

        return [phase - angle, phase + angle].flatMap((candidate) => {
            const t = ((candidate % TAU) + TAU) % TAU;
            const inArc = t >= outline.from - EPSILON && t <= outline.to + EPSILON;
            if (!inArc && !(t < EPSILON && outline.to === TAU)) {
                return [];
            }

            return [
                {
                    x: outline.center.x + outline.u.x * Math.cos(t) + outline.v.x * Math.sin(t),
                    y: outline.center.y + outline.u.y * Math.cos(t) + outline.v.y * Math.sin(t)
                }
            ];
        });
    });
    // A corner, tangency or overlapping outlines should produce one dot.
    const unique = new Map<string, Point>();
    points.forEach((point) =>
        unique.set(`${Math.round(point.x * 1000)}:${Math.round(point.y * 1000)}`, point)
    );

    return [...unique.values()];
}
