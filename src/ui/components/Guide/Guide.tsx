import React, { FC } from 'react';
import { Orientation } from 'src/app/types';

import styles from './styles.css';

/** How far from the canvas's edge, in screen pixels, a dragged guide's position is shown. */
const LABEL_INSET = 28;
/** How far from its line, in screen pixels, a dragged guide's position is shown. */
const LABEL_GAP = 6;

export interface Props {
    orientation: Orientation;
    /** Screen pixels from the canvas's top edge when horizontal, its left edge when vertical. */
    at: number;
    /** Whether releasing the guide here removes it. */
    removing?: boolean;
    /** Its position in canvas units, shown beside it while it is dragged. */
    position?: number;
    selected?: boolean;
}

/** A guide's line across the canvas. */
export const Guide: FC<Props> = ({
    orientation,
    at,
    removing = false,
    position,
    selected = false
}) => {
    const horizontal = orientation === 'horizontal';

    return (
        <>
            <line
                className={removing ? `${styles.line} ${styles.removing}` : styles.line}
                data-selected={selected}
                x1={horizontal ? 0 : at}
                y1={horizontal ? at : 0}
                x2={horizontal ? '100%' : at}
                y2={horizontal ? at : '100%'}
            />
            {position !== undefined && (
                <text
                    className={styles.position}
                    data-guide-position=""
                    x={horizontal ? LABEL_INSET : at + LABEL_GAP}
                    y={horizontal ? at - LABEL_GAP : LABEL_INSET}
                >
                    {position}
                </text>
            )}
        </>
    );
};
