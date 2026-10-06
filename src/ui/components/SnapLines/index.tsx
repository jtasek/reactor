import React, { FC } from 'react';
import { useCameraScale, useEffects, useSnapLines, useSnappedBox } from 'src/app/hooks';
import { snapMarks } from 'src/app/snapping';
import styles from './styles.css';

/** Sizes on screen, in pixels, whatever the zoom. */
const LINE_OVERHANG = 6;
const CROSS_HALF_SIZE = 4;

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

    const overhang = LINE_OVERHANG / scale;
    const cross = CROSS_HALF_SIZE / scale;
    const path = snapMarks(lines, box, targets)
        .map(({ from, to, points }) => {
            const across = from.y === to.y;
            const start = across
                ? `${from.x - overhang} ${from.y}`
                : `${from.x} ${from.y - overhang}`;
            const end = across ? `${to.x + overhang} ${to.y}` : `${to.x} ${to.y + overhang}`;
            const crosses = points
                .map(
                    ({ x, y }) =>
                        `M${x - cross} ${y - cross}L${x + cross} ${y + cross}M${x + cross} ${y - cross}L${x - cross} ${y + cross}`
                )
                .join('');

            return `M${start}L${end}${crosses}`;
        })
        .join('');

    return (
        <g className={styles.snapLines}>
            <path className={styles.halo} d={path} />
            <path className={styles.line} d={path} />
        </g>
    );
};
