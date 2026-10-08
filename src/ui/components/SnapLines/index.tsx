import React, { FC, memo } from 'react';
import {
    useCameraScale,
    useEffects,
    useEqualGaps,
    useSnapLines,
    useSnappedBox
} from 'src/app/hooks';
import { snapDistances } from 'src/app/snapDistances';
import { Gap, gapLength, SnapMark, snapMarks, snapTargetPoints } from 'src/app/snapping';
import type { Point } from 'src/app/types';
import styles from './styles.css';

/** Sizes on screen, in pixels, whatever the zoom. */
const LINE_OVERHANG = 6;
const CROSS_HALF_SIZE = 4;
export const TICK_HALF_SIZE = 4;
const LABEL_OFFSET = 10;

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

export const measurePath = ({ axis, from, to }: Gap, half: number) =>
    axis === 'x'
        ? `M${from.x} ${from.y - half}V${from.y + half}M${from.x} ${from.y}H${to.x}M${to.x} ${to.y - half}V${to.y + half}`
        : `M${from.x - half} ${from.y}H${from.x + half}M${from.x} ${from.y}V${to.y}M${to.x - half} ${to.y}H${to.x + half}`;

interface GapLabelsProps {
    gaps: Gap[];
    scale: number;
    className: string;
}

export const GapLabels: FC<GapLabelsProps> = ({ gaps, scale, className }) =>
    gaps.map((gap) => {
        const { axis, from, to } = gap;
        const x = (from.x + to.x) / 2 + (axis === 'y' ? LABEL_OFFSET / scale : 0);
        const y = (from.y + to.y) / 2 - (axis === 'x' ? LABEL_OFFSET / scale : 0);

        return (
            <text
                key={`${axis}${from.x},${from.y}`}
                className={className}
                textAnchor={axis === 'x' ? 'middle' : 'start'}
                transform={`translate(${x} ${y}) scale(${1 / scale})`}
            >
                {Math.round(gapLength(gap))}
            </text>
        );
    });

const EqualGaps: FC<{ scale: number }> = ({ scale }) => {
    const gaps = useEqualGaps();

    if (gaps.length === 0) {
        return null;
    }

    const path = gaps.map((gap) => measurePath(gap, TICK_HALF_SIZE / scale)).join('');

    return (
        <g className={styles.snapLines}>
            <path className={styles.halo} d={path} />
            <path className={styles.line} d={path} />
            <GapLabels gaps={gaps} scale={scale} className={styles.gapLabel} />
        </g>
    );
};

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
 * and centers of the selection's box and of the other shapes. Along each line, the
 * distance to the nearest other shape on it is measured.
 */
export const SnapLines: FC = () => {
    const lines = useSnapLines();
    const box = useSnappedBox();
    const scale = useCameraScale();
    const { dragTargets } = useEffects();
    const targets = dragTargets.current();

    if (!lines || !box || !targets) {
        return <EqualGaps scale={scale} />;
    }

    const distances = snapDistances(lines, box, targets);
    const path =
        snapMarks(lines, box, targets)
            .map(
                (mark) =>
                    linePath(mark, LINE_OVERHANG / scale) +
                    crossesPath(mark.boxPoints, CROSS_HALF_SIZE / scale)
            )
            .join('') + distances.map((gap) => measurePath(gap, TICK_HALF_SIZE / scale)).join('');

    // The lines' halo below the other shapes' crosses, and the lines over them.
    return (
        <>
            <g className={styles.snapLines}>
                <path className={styles.halo} d={path} />
                <TargetCrosses lineX={lines.x} lineY={lines.y} scale={scale} />
                <path className={styles.line} d={path} />
                <GapLabels gaps={distances} scale={scale} className={styles.distanceLabel} />
            </g>
            <EqualGaps scale={scale} />
        </>
    );
};
