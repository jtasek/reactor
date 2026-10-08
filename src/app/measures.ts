import type { Gap } from './snapping';
import type { Box } from './types';

type Axis = Gap['axis'];

const start = (box: Box, axis: Axis) => (axis === 'x' ? box.topLeft.x : box.topLeft.y);
const end = (box: Box, axis: Axis) => (axis === 'x' ? box.bottomRight.x : box.bottomRight.y);

const measure = (axis: Axis, from: number, to: number, across: number): Gap =>
    axis === 'x'
        ? { axis, from: { x: from, y: across }, to: { x: to, y: across } }
        : { axis, from: { x: across, y: from }, to: { x: across, y: to } };

/**
 * The measures along `axis` between `selection` and `target`: the gap between them when
 * they are apart, or else the distances between their starts and between their ends.
 * Each is drawn midway across their overlap, or across the selection's middle without one.
 */
function measuresAlong(selection: Box, target: Box, axis: Axis): Gap[] {
    const crossAxis: Axis = axis === 'x' ? 'y' : 'x';
    const overlapStart = Math.max(start(selection, crossAxis), start(target, crossAxis));
    const overlapEnd = Math.min(end(selection, crossAxis), end(target, crossAxis));
    const across =
        overlapStart < overlapEnd
            ? (overlapStart + overlapEnd) / 2
            : (start(selection, crossAxis) + end(selection, crossAxis)) / 2;

    if (start(target, axis) >= end(selection, axis)) {
        return [measure(axis, end(selection, axis), start(target, axis), across)];
    }

    if (end(target, axis) <= start(selection, axis)) {
        return [measure(axis, end(target, axis), start(selection, axis), across)];
    }

    const starts = [start(selection, axis), start(target, axis)].sort((a, b) => a - b);
    const ends = [end(selection, axis), end(target, axis)].sort((a, b) => a - b);

    return [starts, ends]
        .filter(([from, to]) => from < to)
        .map(([from, to]) => measure(axis, from, to, across));
}

/** The distances shown between the selection's box and another shape's, across then down. */
export const measuresBetween = (selection: Box, target: Box): Gap[] => [
    ...measuresAlong(selection, target, 'x'),
    ...measuresAlong(selection, target, 'y')
];
