import type { Box, Point } from './types';

/** How near on screen, in pixels, a moved box's edge or center is pulled onto a line. */
export const SNAP_DISTANCE_PX = 6;

/**
 * The lines a moved box may snap to, across (`xs`) and down (`ys`), and, for each,
 * where along it the targets' corners, edge middles and centers lie: the `y`s of
 * those on a line across (`alongXs`) and the `x`s of those on a line down (`alongYs`).
 */
export interface SnapTargets {
    xs: number[];
    ys: number[];
    alongXs: Map<number, number[]>;
    alongYs: Map<number, number[]>;
}

/** The lines a moved box snaps to, where `y` or `x` is null when it snapped to none. */
export interface SnapLines {
    x: number | null;
    y: number | null;
}

/** A line a moved box snapped to, as drawn: from its first to its last point lined up. */
export interface SnapMark {
    from: Point;
    to: Point;
    /** The corners, edge middles and centers of the box and the targets on the line. */
    points: Point[];
}

/** A box's left edge, center and right edge (`xs`), and its top, middle and bottom (`ys`). */
const thirds = ({ topLeft, width, height }: Box) => ({
    xs: [topLeft.x, topLeft.x + width / 2, topLeft.x + width],
    ys: [topLeft.y, topLeft.y + height / 2, topLeft.y + height]
});

/** The edges and centers of `boxes`, as lines to snap to, sorted, each once. */
export function targetLines(boxes: Box[]): SnapTargets {
    const alongXs = new Map<number, number[]>();
    const alongYs = new Map<number, number[]>();
    const add = (along: Map<number, number[]>, line: number, points: number[]) => {
        const held = along.get(line);

        if (held) {
            held.push(...points);

            return;
        }

        along.set(line, [...points]);
    };

    for (const box of boxes) {
        const { xs, ys } = thirds(box);

        xs.forEach((x) => add(alongXs, x, ys));
        ys.forEach((y) => add(alongYs, y, xs));
    }

    const sorted = (along: Map<number, number[]>) => [...along.keys()].sort((a, b) => a - b);

    return { xs: sorted(alongXs), ys: sorted(alongYs), alongXs, alongYs };
}

/** How far apart two coordinates may be and still be on one line. */
const ON_LINE = 1e-6;

/**
 * Where along `line` the points lined up on it lie, sorted and each once: the
 * targets' (`held`), and the box's (`boxAlong`) when one of its edges or its center
 * (`boxThirds`) is on the line.
 */
function pointsOnLine(line: number, boxThirds: number[], boxAlong: number[], held: number[] = []) {
    const boxOnLine = boxThirds.some((third) => Math.abs(third - line) <= ON_LINE);

    return [...new Set([...held, ...(boxOnLine ? boxAlong : [])])].sort((a, b) => a - b);
}

/**
 * What a box, moved to `box`, snapped to on each of `lines`: the line from the first
 * to the last of the points lined up on it, the box's and the targets', each once.
 */
export function snapMarks(lines: SnapLines, box: Box, targets: SnapTargets): SnapMark[] {
    const { xs, ys } = thirds(box);
    const marks: SnapMark[] = [];

    if (lines.x !== null) {
        const x = lines.x;
        const points = pointsOnLine(x, xs, ys, targets.alongXs.get(x)).map((y) => ({ x, y }));

        marks.push({ from: points[0], to: points[points.length - 1], points });
    }

    if (lines.y !== null) {
        const y = lines.y;
        const points = pointsOnLine(y, ys, xs, targets.alongYs.get(y)).map((x) => ({ x, y }));

        marks.push({ from: points[0], to: points[points.length - 1], points });
    }

    return marks;
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
