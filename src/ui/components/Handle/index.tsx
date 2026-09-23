import React, { FC } from 'react';

import styles from './styles.css';
import { Point, ResizeHandlerType } from '../../../app/types';

export interface Props {
    shapeId: string;
    position: Point;
    size?: number;
    handlerType: ResizeHandlerType;
    active: boolean;
}

export const Handle: FC<Props> = ({ shapeId, position, handlerType, size = 5, active = false }) => {
    const classes = [styles.handle, styles[handlerType], active ? styles.active : undefined];

    return (
        <circle
            key={handlerType}
            className={classes.join(' ')}
            cx={position.x}
            cy={position.y}
            r={size}
            data-handle
            data-shape-id={shapeId}
            data-type={handlerType}
            onPointerDown={(e) => e.preventDefault()}
        />
    );
};
