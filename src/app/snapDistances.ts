import {
    Axis,
    Gap,
    SnapLines,
    SnapTargets,
    boxEnd,
    boxStart,
    crossAxis,
    gapBetween,
    gapLength
} from './snapping';
import type { Box } from './types';

/**
 * The gap from `box` to the nearest other shape on each of `lines` it snapped to, along
 * the line, where one lies apart from it there.
 */
export function snapDistances(lines: SnapLines, box: Box, targets: SnapTargets): Gap[] {
    const nearestGapAlong = (axis: Axis, line: number) => {
        const along = crossAxis(axis);
        const onLine = (axis === 'x' ? targets.boxesByX : targets.boxesByY).get(line) ?? [];
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
