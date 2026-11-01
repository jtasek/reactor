import React, { FC } from 'react';
import type { GuideLabelPlace } from 'src/app/rulers';
import { Orientation, Point } from 'src/app/types';

import styles from './styles.css';

export interface Props {
    orientation: Orientation;
    /** Screen pixels from the canvas's top edge when horizontal, its left edge when vertical. */
    at: number;
    /** Whether releasing the guide here removes it. */
    removing?: boolean;
    /** Its position in canvas units, shown beside the pointer while it is dragged. */
    position?: number;
    /** Where `position` is shown. */
    label?: GuideLabelPlace;
    selected?: boolean;
    marks?: Point[];
}

/** A guide's line across the canvas. */
export const Guide: FC<Props> = ({
    orientation,
    at,
    removing = false,
    position,
    label,
    selected = false,
    marks = []
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
            {position !== undefined &&
                !removing &&
                marks.map((point, index) => (
                    <circle
                        key={index}
                        data-guide-intersection=""
                        className={styles.intersection}
                        cx={point.x}
                        cy={point.y}
                        r={3}
                    />
                ))}
            {position !== undefined && label && (
                <text
                    className={styles.position}
                    data-guide-position=""
                    dominantBaseline={label.baseline}
                    textAnchor={label.anchor}
                    x={label.x}
                    y={label.y}
                >
                    {position}
                </text>
            )}
        </>
    );
};
