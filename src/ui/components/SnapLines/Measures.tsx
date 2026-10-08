import React, { FC } from 'react';
import { useCameraScale, useMeasuredBoxes } from 'src/app/hooks';
import { measuresBetween } from 'src/app/measures';
import { GapLabels, measurePath, TICK_HALF_SIZE } from '.';
import styles from './styles.css';

/** With Alt held over another shape, the distances between it and the selection. */
export const Measures: FC = () => {
    const boxes = useMeasuredBoxes();
    const scale = useCameraScale();

    if (!boxes) {
        return null;
    }

    const measures = measuresBetween(boxes.selection, boxes.target);
    const path = measures.map((measure) => measurePath(measure, TICK_HALF_SIZE / scale)).join('');

    return (
        <g className={styles.snapLines} data-measures="">
            <path className={styles.halo} d={path} />
            <path className={styles.line} d={path} />
            <GapLabels gaps={measures} scale={scale} className={styles.distanceLabel} />
        </g>
    );
};
