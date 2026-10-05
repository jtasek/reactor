import React, { FC } from 'react';

import styles from './styles.css';
import type { HandleOwner } from 'src/events/types';
import { Point } from 'src/app/types';

export interface Props {
    owner: HandleOwner;
    position: Point;
    size?: number;
    active: boolean;
}

export const RotateHandle: FC<Props> = ({ owner, position, size = 5, active = false }) => {
    const classes = [styles.handle, styles.rotate, active ? styles.active : undefined];

    return (
        <circle
            className={classes.join(' ')}
            cx={position.x}
            cy={position.y}
            r={size}
            data-handle
            data-shape-id={'shapeId' in owner ? owner.shapeId : undefined}
            data-group-id={'groupId' in owner ? owner.groupId : undefined}
            data-type="rotate"
            onPointerDown={(e) => e.preventDefault()}
        />
    );
};
