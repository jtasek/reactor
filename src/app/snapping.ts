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

/** The edges and centers of `boxes`, as lines to snap to, sorted, each once. */
export function targetLines(boxes: Box[]): SnapTargets {
    const sortedOnce = (lines: number[]) =>
        lines
            .sort((a, b) => a - b)
            .filter((line, index, sorted) => index === 0 || line !== sorted[index - 1]);

    return {
        xs: sortedOnce(
            boxes.flatMap(({ topLeft, bottomRight, width }) => [
                topLeft.x,
                topLeft.x + width / 2,
                bottomRight.x
            ])
        ),
        ys: sortedOnce(
            boxes.flatMap(({ topLeft, bottomRight, height }) => [
                topLeft.y,
                topLeft.y + height / 2,
                bottomRight.y
            ])
        )
    };
}

/** The index of the first of the sorted `lines` at or after `value`. */
function firstAtOrAfter(lines: number[], value: number) {
    let low = 0;
    let high = lines.length;

    while (low < high) {
        const middle = (low + high) >> 1;

        if (lines[middle] < value) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }

    return low;
}

/**
 * The shift bringing the start, middle or end of a span from `start` of `size`
 * onto the nearest of the sorted `lines` within `reach`, and that line; none
 * is within reach when `line` is null.
 */
function nearestEdgeShift(start: number, size: number, lines: number[], reach: number) {
    let line: number | null = null;
    let shift = 0;

    for (let part = 0; part <= 2; part++) {
        const edge = start + (size * part) / 2;
        const index = firstAtOrAfter(lines, edge);

        for (
            let neighbor = Math.max(0, index - 1);
            neighbor <= index && neighbor < lines.length;
            neighbor++
        ) {
            const candidate = lines[neighbor] - edge;

            if (
                Math.abs(candidate) <= reach &&
                (line === null || Math.abs(candidate) < Math.abs(shift))
            ) {
                line = lines[neighbor];
                shift = candidate;
            }
        }
    }

    return { line, shift };
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
    const across = nearestEdgeShift(left, box.width, targets.xs, reach);
    const down = nearestEdgeShift(top, box.height, targets.ys, reach);

    return {
        delta: { x: delta.x + across.shift, y: delta.y + down.shift },
        lines: { x: across.line, y: down.line }
    };
}
