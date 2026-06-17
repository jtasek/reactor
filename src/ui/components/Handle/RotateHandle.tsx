import React, { FC, useEffect } from 'react';

import styles from './styles.css';
import { Point } from '../../../app/types';
import { useActions, usePointer } from 'src/app/hooks';

export interface Props {
    shapeId: string;
    position: Point;
    size?: number;
    active: boolean;
    onActivate: (active: boolean) => void;
}

export const RotateHandle: FC<Props> = ({
    shapeId,
    position,
    onActivate,
    size = 5,
    active = false
}) => {
    const { rotateShape } = useActions();
    const { current, dragging } = usePointer();

    useEffect(() => {
        if (active && dragging) {
            rotateShape({ shapeId, position: current });
        }
    }, [active, dragging, current, shapeId, rotateShape]);

    const classes = [styles.handle, styles.rotate, active ? styles.active : undefined];

    return (
        <circle
            className={classes.join(' ')}
            cx={position.x}
            cy={position.y}
            r={size}
            data-handle
            data-type="rotate"
            onPointerDown={(e) => {
                e.preventDefault();
                onActivate(true);
            }}
            onPointerUp={(e) => {
                e.preventDefault();
                onActivate(false);
            }}
        />
    );
};
