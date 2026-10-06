import { aspectRatio, resizeAspectBox } from './geometry';
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
    boxes: Box[];
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

    return { xs: sorted(alongXs), ys: sorted(alongYs), alongXs, alongYs, boxes };
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
 * A gap between two boxes along `axis`, from one's edge to the other's, midway across
 * their overlap.
 */
export interface Gap {
    axis: SnapMark['axis'];
    from: Point;
    to: Point;
}

type Axis = SnapMark['axis'];

const crossAxis = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x');

const boxStart = (box: Box, axis: Axis) => (axis === 'x' ? box.topLeft.x : box.topLeft.y);

const boxEnd = (box: Box, axis: Axis) => (axis === 'x' ? box.bottomRight.x : box.bottomRight.y);

const shifted = (box: Box, axis: Axis, by: number): Box => {
    const step = axis === 'x' ? { x: by, y: 0 } : { x: 0, y: by };

    return {
        topLeft: { x: box.topLeft.x + step.x, y: box.topLeft.y + step.y },
        bottomRight: { x: box.bottomRight.x + step.x, y: box.bottomRight.y + step.y },
        width: box.width,
        height: box.height
    };
};

const gapBetween = (before: Box, after: Box, axis: Axis): Gap => {
    const across = crossAxis(axis);
    const middle =
        (Math.max(boxStart(before, across), boxStart(after, across)) +
            Math.min(boxEnd(before, across), boxEnd(after, across))) /
        2;
    const from = boxEnd(before, axis);
    const to = boxStart(after, axis);

    return axis === 'x'
        ? { axis, from: { x: from, y: middle }, to: { x: to, y: middle } }
        : { axis, from: { x: middle, y: from }, to: { x: middle, y: to } };
};

const gapLength = ({ axis, from, to }: Gap) => (axis === 'x' ? to.x - from.x : to.y - from.y);

const rowBoxes = (box: Box, boxes: Box[], axis: Axis) => {
    const across = crossAxis(axis);

    return boxes
        .filter(
            (other) =>
                boxStart(other, across) < boxEnd(box, across) &&
                boxEnd(other, across) > boxStart(box, across)
        )
        .sort((a, b) => boxStart(a, axis) - boxStart(b, axis));
};

const rowGaps = (row: Box[], axis: Axis) =>
    row.slice(1).flatMap((after, index) => {
        const before = row[index];

        return boxStart(after, axis) >= boxEnd(before, axis)
            ? [gapBetween(before, after, axis)]
            : [];
    });

const gapStart = (gap: Gap) => (gap.axis === 'x' ? gap.from.x : gap.from.y);

/**
 * The shifts along `axis`, within `reach` and nearest first, that put `box` as far from
 * a neighbor in its row as two of the row's boxes are apart, or midway between its two
 * neighbors, each with the gap's length.
 */
function equalGapShifts(box: Box, boxes: Box[], axis: Axis, reach: number) {
    const row = rowBoxes(box, boxes, axis);
    const start = boxStart(box, axis);
    const end = boxEnd(box, axis);
    const before = row
        .filter((other) => boxEnd(other, axis) <= start + reach)
        .sort((a, b) => boxEnd(b, axis) - boxEnd(a, axis))[0];
    const after = row
        .filter((other) => boxStart(other, axis) >= end - reach)
        .sort((a, b) => boxStart(a, axis) - boxStart(b, axis))[0];
    const shifts = rowGaps(row, axis)
        .map(gapLength)
        .flatMap((length) => [
            ...(before ? [{ shift: boxEnd(before, axis) + length - start, length }] : []),
            ...(after ? [{ shift: boxStart(after, axis) - length - end, length }] : [])
        ]);

    if (before && after) {
        const length = (boxStart(after, axis) - boxEnd(before, axis) - (end - start)) / 2;

        shifts.push({ shift: boxEnd(before, axis) + length - start, length });
    }

    return shifts
        .filter(({ shift, length }) => length > 0 && Math.abs(shift) <= reach)
        .sort((a, b) => Math.abs(a.shift) - Math.abs(b.shift));
}

/** The gaps of `length` in `box`'s row along `axis`, its own among them, in order. */
function equalGaps(box: Box, boxes: Box[], axis: Axis, length: number): Gap[] {
    const row = rowBoxes(box, boxes, axis);
    const withBox = [...row, box].sort((a, b) => boxStart(a, axis) - boxStart(b, axis));
    const equal = [...rowGaps(row, axis), ...rowGaps(withBox, axis)].filter(
        (gap) => Math.abs(gapLength(gap) - length) <= ON_LINE
    );

    return equal
        .filter(
            (gap, index) =>
                equal.findIndex((other) => Math.abs(gapStart(other) - gapStart(gap)) <= ON_LINE) ===
                index
        )
        .sort((a, b) => gapStart(a) - gapStart(b));
}

/**
 * Moves `box` by `delta`, then pulls it, on each axis on its own, so the nearest of
 * its edges and center lies on a target line within `reach`, or so it is as far from
 * a neighbor in its row as others there are apart, whichever is nearer; `gaps` are the
 * gaps it then has equal to others.
 */
export function snapMove(
    box: Box,
    delta: Point,
    targets: SnapTargets,
    reach: number
): { delta: Point; lines: SnapLines; gaps: Gap[] } {
    const pulled = shifted(shifted(box, 'x', delta.x), 'y', delta.y);
    const pull = (axis: Axis) => {
        const edge = nearestEdgeShift(
            boxStart(pulled, axis),
            axis === 'x' ? box.width : box.height,
            axis === 'x' ? targets.xs : targets.ys,
            reach
        );
        const [spaced] = equalGapShifts(pulled, targets.boxes, axis, reach);

        return spaced && (edge.line === null || Math.abs(spaced.shift) < Math.abs(edge.shift))
            ? { shift: spaced.shift, line: null, equalGap: spaced.length }
            : { shift: edge.shift, line: edge.line, equalGap: null };
    };
    const across = pull('x');
    const down = pull('y');
    const snapped = shifted(shifted(pulled, 'x', across.shift), 'y', down.shift);

    return {
        delta: { x: delta.x + across.shift, y: delta.y + down.shift },
        lines: { x: across.line, y: down.line },
        gaps: [
            ...(across.equalGap === null
                ? []
                : equalGaps(snapped, targets.boxes, 'x', across.equalGap)),
            ...(down.equalGap === null ? [] : equalGaps(snapped, targets.boxes, 'y', down.equalGap))
        ]
    };
}

/**
 * The gap from `box` to the nearest other shape on each of `lines` it snapped to, along
 * the line, where one lies apart from it there.
 */
export function snapDistances(lines: SnapLines, box: Box, targets: SnapTargets): Gap[] {
    const nearestGapAlong = (axis: Axis, line: number) => {
        const along = crossAxis(axis);
        const onLine = targets.boxes.filter((other) =>
            thirds(other)[axis === 'x' ? 'xs' : 'ys'].some(
                (third) => Math.abs(third - line) <= ON_LINE
            )
        );
        const gaps = onLine.flatMap((other) => {
            if (boxEnd(other, along) <= boxStart(box, along)) {
                return [gapBetween(other, box, along)];
            }

            return boxStart(other, along) >= boxEnd(box, along)
                ? [gapBetween(box, other, along)]
                : [];
        });
        const [nearest] = gaps.sort((a, b) => gapLength(a) - gapLength(b));

        if (!nearest) {
            return [];
        }

        return axis === 'x'
            ? [
                  {
                      ...nearest,
                      from: { x: line, y: nearest.from.y },
                      to: { x: line, y: nearest.to.y }
                  }
              ]
            : [
                  {
                      ...nearest,
                      from: { x: nearest.from.x, y: line },
                      to: { x: nearest.to.x, y: line }
                  }
              ];
    };

    return [
        ...(lines.x === null ? [] : nearestGapAlong('x', lines.x)),
        ...(lines.y === null ? [] : nearestGapAlong('y', lines.y))
    ];
}

/** `point` pulled onto the nearest line within `reach` on each of `axes`, and those lines. */
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
 * A box kept in proportion is sized by the axis the pointer pulls further, so its
 * resized moving edges snap, and the handle takes the corner the box then has.
 */
function snapProportionalCorner(
    box: Box,
    handle: ResizeHandlerType,
    pointer: Point,
    targets: SnapTargets,
    reach: number
): { point: Point; lines: SnapLines } {
    const edges = movedEdges(handle);
    const ratio = aspectRatio(box);
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
 * Where a resize handle pulled to `pointer` goes so the edges it moves snap. `box` is
 * the box the resize began from, in its own frame; a quarter turn swaps its axes.
 */
export function snapResize(
    box: Box,
    handle: ResizeHandlerType,
    pointer: Point,
    proportional: boolean,
    rotation: number,
    targets: SnapTargets,
    reach: number
): { point: Point; lines: SnapLines } {
    const edges = movedEdges(handle);
    const across = edges.left || edges.right;
    const down = edges.top || edges.bottom;

    if (proportional && across && down && rotation % 360 === 0) {
        return snapProportionalCorner(box, handle, pointer, targets, reach);
    }

    const sideways = Math.abs(rotation % 180) === 90;

    return snapPoint(
        pointer,
        sideways ? { x: down, y: across } : { x: across, y: down },
        targets,
        reach
    );
}
