import React, { FC, memo } from 'react';
import { useCameraScale, useEffects, useSnapLines, useSnappedBox } from 'src/app/hooks';
import { SnapMark, snapMarks, snapTargetPoints } from 'src/app/snapping';
import type { Point } from 'src/app/types';
import styles from './styles.css';

/** Sizes on screen, in pixels, whatever the zoom. */
const LINE_OVERHANG = 6;
const CROSS_HALF_SIZE = 4;

/** A cross on each of `points`, `half` across each way. */
const crossesPath = (points: Point[], half: number) =>
    points
        .map(
            ({ x, y }) =>
                `M${x - half} ${y - half}L${x + half} ${y + half}M${x + half} ${y - half}L${x - half} ${y + half}`
        )
        .join('');

/** A snap line from its first to its last point, `overhang` beyond each. */
const linePath = ({ axis, from, to }: SnapMark, overhang: number) =>
    axis === 'x'
        ? `M${from.x} ${from.y - overhang}L${to.x} ${to.y + overhang}`
        : `M${from.x - overhang} ${from.y}L${to.x + overhang} ${to.y}`;

interface TargetCrossesProps {
    lineX: number | null;
    lineY: number | null;
    scale: number;
}

/**
 * The crosses on the other shapes' points on the snapped lines, drawn again only
 * when the lines or the zoom change, not as the selection slides along a line.
 */
const TargetCrosses: FC<TargetCrossesProps> = memo(({ lineX, lineY, scale }) => {
    const { dragTargets } = useEffects();
    const targets = dragTargets.current();

    if (!targets) {
        return null;
    }

    const path = crossesPath(
        snapTargetPoints({ x: lineX, y: lineY }, targets),
        CROSS_HALF_SIZE / scale
    );

    return (
        <>
            <path className={styles.halo} d={path} />
            <path className={styles.line} d={path} />
        </>
    );
});

TargetCrosses.displayName = 'TargetCrosses';

/**
 * The lines a dragged selection snapped to, each from the first to the last point
 * lined up on it, with a cross on each of those points: the corners, edge middles
 * and centers of the selection's box and of the other shapes.
 */
export const SnapLines: FC = () => {
    const lines = useSnapLines();
    const box = useSnappedBox();
    const scale = useCameraScale();
    const { dragTargets } = useEffects();
    const targets = dragTargets.current();

    if (!lines || !box || !targets) {
        return null;
    }

    const path = snapMarks(lines, box, targets)
        .map(
            (mark) =>
                linePath(mark, LINE_OVERHANG / scale) +
                crossesPath(mark.boxPoints, CROSS_HALF_SIZE / scale)
        )
        .join('');

    // The lines' halo below the other shapes' crosses, and the lines over them.
    return (
        <g className={styles.snapLines}>
            <path className={styles.halo} d={path} />
            <TargetCrosses lineX={lines.x} lineY={lines.y} scale={scale} />
            <path className={styles.line} d={path} />
        </g>
    );
};
