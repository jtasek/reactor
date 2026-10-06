import { resizeAspectBox } from './geometry';
import type { Box, Point, ResizeHandlerType } from './types';
import { movedEdges } from './utils';

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
    /** A line down, at an `x`, or across, at a `y`. */
    axis: 'x' | 'y';
    from: Point;
    to: Point;
    /** The corners, edge middles or center of the box on the line. */
    boxPoints: Point[];
    /** Those of the targets on the line, each once. */
    targetPoints: Point[];
}

/** How many parts of a canvas unit lines and points are told apart by, so float noise merges. */
const PRECISION = 1e6;

/** How far apart two coordinates may be and still be on one line. */
const ON_LINE = 1 / PRECISION;

const rounded = (value: number) => Math.round(value * PRECISION) / PRECISION;

/** A box's left edge, center and right edge (`xs`), and its top, middle and bottom (`ys`). */
const thirds = ({ topLeft, width, height }: Box) => ({
    xs: [topLeft.x, topLeft.x + width / 2, topLeft.x + width].map(rounded),
    ys: [topLeft.y, topLeft.y + height / 2, topLeft.y + height].map(rounded)
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

const sortedOnce = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

/** The point `along` a line on `axis` at `line`. */
const pointOn = (axis: SnapMark['axis'], line: number, along: number): Point =>
    axis === 'x' ? { x: line, y: along } : { x: along, y: line };

/** The targets' corners, edge middles and centers on the line on `axis` at `line`, each once. */
const targetPointsOn = (axis: SnapMark['axis'], line: number, targets: SnapTargets) =>
    sortedOnce((axis === 'x' ? targets.alongXs : targets.alongYs).get(line) ?? []).map((along) =>
        pointOn(axis, line, along)
    );

/** The targets' points on each of `lines`: see `targetPointsOn`. */
export const snapTargetPoints = (lines: SnapLines, targets: SnapTargets): Point[] => [
    ...(lines.x === null ? [] : targetPointsOn('x', lines.x, targets)),
    ...(lines.y === null ? [] : targetPointsOn('y', lines.y, targets))
];

/**
 * What a box, moved to `box`, snapped to on each of `lines`: the line from the first
 * to the last of the points lined up on it, and those points, the box's and the targets'.
 */
export function snapMarks(lines: SnapLines, box: Box, targets: SnapTargets): SnapMark[] {
    const { xs, ys } = thirds(box);
    const markOn = (
        axis: SnapMark['axis'],
        line: number,
        boxThirds: number[],
        boxAlong: number[]
    ) => {
        const targetPoints = targetPointsOn(axis, line, targets);
        const boxOnLine = boxThirds.some((third) => Math.abs(third - line) <= ON_LINE);
        const boxPoints = boxOnLine ? boxAlong.map((along) => pointOn(axis, line, along)) : [];
        const alongs = [...targetPoints, ...boxPoints].map(({ x, y }) => (axis === 'x' ? y : x));

        return {
            axis,
            from: pointOn(axis, line, Math.min(...alongs)),
            to: pointOn(axis, line, Math.max(...alongs)),
            boxPoints,
            targetPoints
        };
    };

    return [
        ...(lines.x === null ? [] : [markOn('x', lines.x, xs, ys)]),
        ...(lines.y === null ? [] : [markOn('y', lines.y, ys, xs)])
    ];
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

/**
 * `point` pulled onto the nearest target line within `reach` on each axis `axes`
 * names, as a resize handle's edges are, and the lines it was pulled onto.
 */
export function snapPoint(
    point: Point,
    axes: { x: boolean; y: boolean },
    targets: SnapTargets,
    reach: number
): { point: Point; lines: SnapLines } {
    const across = axes.x ? nearestEdgeShift(point.x, 0, targets.xs, reach) : null;
    const down = axes.y ? nearestEdgeShift(point.y, 0, targets.ys, reach) : null;

    return {
        point: { x: point.x + (across?.shift ?? 0), y: point.y + (down?.shift ?? 0) },
        lines: { x: across?.line ?? null, y: down?.line ?? null }
    };
}

/** Those of `lines` that an edge of `box` lies on; a resize kept in proportion may miss one. */
export function linesOnEdges(lines: SnapLines, box: Box): SnapLines {
    const on = (line: number | null, edges: number[]) =>
        line !== null && edges.some((edge) => Math.abs(edge - line) <= ON_LINE) ? line : null;

    return {
        x: on(lines.x, [box.topLeft.x, box.bottomRight.x]),
        y: on(lines.y, [box.topLeft.y, box.bottomRight.y])
    };
}

/**
 * The corner a handle pulled to `pointer` takes so a box kept in proportion (`ratio`)
 * snaps: such a box is sized by the axis the pointer pulls further, so it is the
 * resized box's moving edges that snap, the nearer one within reach, and the corner
 * becomes the one the box has with that edge on its line.
 */
function snapProportionalCorner(
    box: Box,
    handle: ResizeHandlerType,
    pointer: Point,
    ratio: number,
    targets: SnapTargets,
    reach: number
): { point: Point; lines: SnapLines } {
    const edges = movedEdges(handle);
    const resized = resizeAspectBox(box, handle, pointer, ratio);
    const fixed = {
        x: edges.right ? box.topLeft.x : box.bottomRight.x,
        y: edges.bottom ? box.topLeft.y : box.bottomRight.y
    };
    const outward = { x: edges.right ? 1 : -1, y: edges.bottom ? 1 : -1 };
    const across = nearestEdgeShift(
        edges.right ? resized.bottomRight.x : resized.topLeft.x,
        0,
        targets.xs,
        reach
    );
    const down = nearestEdgeShift(
        edges.bottom ? resized.bottomRight.y : resized.topLeft.y,
        0,
        targets.ys,
        reach
    );

    if (
        across.line !== null &&
        (down.line === null || Math.abs(across.shift) <= Math.abs(down.shift))
    ) {
        const width = Math.abs(across.line - fixed.x);

        return {
            point: { x: across.line, y: fixed.y + (outward.y * width) / ratio },
            lines: { x: across.line, y: null }
        };
    }

    if (down.line !== null) {
        const height = Math.abs(down.line - fixed.y);

        return {
            point: { x: fixed.x + outward.x * height * ratio, y: down.line },
            lines: { x: null, y: down.line }
        };
    }

    return { point: pointer, lines: { x: null, y: null } };
}

/**
 * Where a resize handle pulled to `pointer` goes so the edges it moves snap: the
 * pointer pulled onto the lines on those edges' axes, which a quarter or three
 * quarters of a turn (`rotation`) swaps, or, at a corner of a box kept in proportion
 * (`ratio`) and not turned, the corner its snapped edge gives. `box` is the box the
 * resize began from, in its own frame.
 */
export function snapResize(
    box: Box,
    handle: ResizeHandlerType,
    pointer: Point,
    ratio: number | null,
    rotation: number,
    targets: SnapTargets,
    reach: number
): { point: Point; lines: SnapLines } {
    const edges = movedEdges(handle);
    const across = edges.left || edges.right;
    const down = edges.top || edges.bottom;

    if (ratio !== null && across && down && rotation % 360 === 0) {
        return snapProportionalCorner(box, handle, pointer, ratio, targets, reach);
    }

    const sideways = Math.abs(rotation % 180) === 90;

    return snapPoint(
        pointer,
        sideways ? { x: down, y: across } : { x: across, y: down },
        targets,
        reach
    );
}
