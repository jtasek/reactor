import React, { FC } from 'react';
import { useSnapLines } from 'src/app/hooks';
import styles from './styles.css';

/** Far enough to cross any canvas the camera shows. */
const REACH = 1_000_000;

/** The lines a dragged selection snapped to, across the canvas, while the drag lasts. */
export const SnapLines: FC = () => {
    const lines = useSnapLines();

    if (!lines) {
        return null;
    }

    return (
        <g className={styles.snapLines}>
            {lines.x !== null && <line x1={lines.x} y1={-REACH} x2={lines.x} y2={REACH} />}
            {lines.y !== null && <line x1={-REACH} y1={lines.y} x2={REACH} y2={lines.y} />}
        </g>
    );
};
