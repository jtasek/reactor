import React, { FC } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Orientation } from 'src/app/types';

import styles from './styles.css';

export interface Props {
    orientation: Orientation;
    /** Screen pixels from the canvas's top edge when horizontal, its left edge when vertical. */
    at: number;
    /** Whether releasing the guide here removes it. */
    leaving?: boolean;
    onPointerDown?: (event: ReactPointerEvent<SVGElement>) => void;
}

export const Guide: FC<Props> = ({ orientation, at, leaving = false, onPointerDown }) => {
    const ends =
        orientation === 'horizontal'
            ? { x1: 0, y1: at, x2: '100%', y2: at }
            : { x1: at, y1: 0, x2: at, y2: '100%' };

    return (
        <g className={leaving ? `${styles[orientation]} ${styles.leaving}` : styles[orientation]}>
            <line className={styles.line} {...ends} />
            {onPointerDown && (
                <line className={styles.grip} onPointerDown={onPointerDown} {...ends} />
            )}
        </g>
    );
};
