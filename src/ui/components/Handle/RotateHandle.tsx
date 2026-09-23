import React, { FC } from 'react';

import styles from './styles.css';
import { Point } from '../../../app/types';

export interface Props {
    shapeId: string;
    position: Point;
    size?: number;
    active: boolean;
}

export const RotateHandle: FC<Props> = ({ shapeId, position, size = 5, active = false }) => {
    const classes = [styles.handle, styles.rotate, active ? styles.active : undefined];

    return (
        <circle
            className={classes.join(' ')}
            cx={position.x}
            cy={position.y}
            r={size}
            data-handle
            data-shape-id={shapeId}
            data-type="rotate"
            onPointerDown={(e) => e.preventDefault()}
        />
    );
};
