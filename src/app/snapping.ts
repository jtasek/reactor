import type { Box, Point } from './types';

/** How near on screen, in pixels, a moved box's edge or center is pulled onto a line. */
export const SNAP_DISTANCE_PX = 6;

/** The lines a moved box may snap to, across (`xs`) and down (`ys`). */
export interface SnapTargets {
    xs: number[];
    ys: number[];
}

/** The lines a moved box snaps to, where `y` or `x` is null when it snapped to none. */
export interface SnapLines {
    x: number | null;
    y: number | null;
}

/** The edges and centers of `boxes`, as lines to snap to. */
export function snapTargets(boxes: Box[]): SnapTargets {
    return {
        xs: boxes.flatMap(({ topLeft, bottomRight, width }) => [
            topLeft.x,
            topLeft.x + width / 2,
            bottomRight.x
        ]),
        ys: boxes.flatMap(({ topLeft, bottomRight, height }) => [
            topLeft.y,
            topLeft.y + height / 2,
            bottomRight.y
        ])
    };
}

/** The shift that brings the nearest of `edges` onto one of `lines` within `reach`. */
function nearestSnap(edges: number[], lines: number[], reach: number) {
    let best: { shift: number; line: number } | null = null;

    for (const edge of edges) {
        for (const line of lines) {
            const shift = line - edge;

            if (Math.abs(shift) <= reach && (!best || Math.abs(shift) < Math.abs(best.shift))) {
                best = { shift, line };
            }
        }
    }

    return best;
}

/**
 * Moves `box` by `delta`, then pulls it so the nearest of its edges and center
 * lies on a target line within `reach`, on each axis on its own.
 */
export function snapMove(
    box: Box,
    delta: Point,
    targets: SnapTargets,
    reach: number
): { delta: Point; lines: SnapLines } {
    const left = box.topLeft.x + delta.x;
    const top = box.topLeft.y + delta.y;
    const across = nearestSnap([left, left + box.width / 2, left + box.width], targets.xs, reach);
    const down = nearestSnap([top, top + box.height / 2, top + box.height], targets.ys, reach);

    return {
        delta: { x: delta.x + (across?.shift ?? 0), y: delta.y + (down?.shift ?? 0) },
        lines: { x: across?.line ?? null, y: down?.line ?? null }
    };
}
