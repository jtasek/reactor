import React, { FC } from 'react';
import { Orientation } from 'src/app/types';

import styles from './styles.css';

export interface Props {
    orientation: Orientation;
    /** Screen pixels from the canvas's top edge when horizontal, its left edge when vertical. */
    at: number;
    /** Whether releasing the guide here removes it. */
    removing?: boolean;
}

/** A guide's line across the canvas. */
export const Guide: FC<Props> = ({ orientation, at, removing = false }) => {
    const horizontal = orientation === 'horizontal';

    return (
        <line
            className={removing ? `${styles.line} ${styles.removing}` : styles.line}
            x1={horizontal ? 0 : at}
            y1={horizontal ? at : 0}
            x2={horizontal ? '100%' : at}
            y2={horizontal ? at : '100%'}
        />
    );
};
