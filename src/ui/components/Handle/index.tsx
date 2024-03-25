import React, { FC, useEffect } from 'react';

import styles from './styles.css';
import { Point, ResizeHandlerType } from '../../../app/types';
import { useActions, usePointer } from 'src/app/hooks';

export interface Props {
    shapeId: string;
    position: Point;
    size?: number;
    handlerType: ResizeHandlerType;
    active: boolean;
    onActivate: (handlerType?: ResizeHandlerType) => void;
}

export const Handle: FC<Props> = ({
    shapeId,
    position,
    handlerType,
    onActivate,
    size = 5,
    active = false
}) => {
    const { resizeShape } = useActions();
    const { current, dragging } = usePointer();

    const handleResize = () => {
        if (active && dragging) {
            console.log('resize', { active, shapeId, handlerType, position: { ...position } });

            resizeShape({ shapeId, handlerType, position: current });
        }
    };

    useEffect(() => {
        handleResize();
    }, [current, dragging]);

    const classes = [styles.handle, styles[handlerType], active ? styles.active : undefined];

    return (
        <circle
            key={handlerType}
            className={classes.join(' ')}
            cx={position.x}
            cy={position.y}
            r={size}
            data-type={handlerType}
            onPointerDown={(e) => {
                e.preventDefault();
                onActivate(handlerType);
            }}
            onPointerUp={(e) => {
                e.preventDefault();
                onActivate(undefined);
            }}
        />
    );
};
