import React, { FC } from 'react';

import styles from './styles.css';
import type { HandleOwner } from '../../../events/types';
import { Point, ResizeHandlerType } from '../../../app/types';

export interface Props {
    owner: HandleOwner;
    position: Point;
    size?: number;
    handlerType: ResizeHandlerType;
    active: boolean;
    cursor?: string;
}

export const Handle: FC<Props> = ({
    owner,
    position,
    handlerType,
    size = 5,
    active = false,
    cursor
}) => {
    const classes = [styles.handle, styles[handlerType], active ? styles.active : undefined];

    return (
        <circle
            key={handlerType}
            className={classes.join(' ')}
            cx={position.x}
            cy={position.y}
            r={size}
            style={cursor ? { cursor } : undefined}
            data-handle
            data-shape-id={'shapeId' in owner ? owner.shapeId : undefined}
            data-group-id={'groupId' in owner ? owner.groupId : undefined}
            data-type={handlerType}
            onPointerDown={(e) => e.preventDefault()}
        />
    );
};
