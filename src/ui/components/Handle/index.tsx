import React, { FC, useEffect, useState } from 'react';

import styles from './styles.css';
import { Point, ResizeHandlerType } from '../../../app/types';
import { useActions, usePointer } from 'src/app/hooks';

export interface Props {
    shapeId: string;
    position: Point;
    size?: number;
    handlerType: ResizeHandlerType;
}

export const Handle: FC<Props> = ({ shapeId, position, handlerType, size = 5 }) => {
    const { resizeShape } = useActions();
    const pointer = usePointer();
    const [active, setActive] = useState(false);

    useEffect(() => {
        if (active) {
            resizeShape({ shapeId, handlerType, position: pointer.current });
        }
    }, [pointer.current]);

    const handleMouseDown = () => {
        setActive(true);
    };

    const handleMouseUp = () => {
        setActive(false);
    };

    const classes = [styles.handle, styles[handlerType]];

    return (
        <circle
            className={classes.join(' ')}
            cx={position.x}
            cy={position.y}
            r={size}
            data-type={handlerType}
            fill={active ? 'red' : 'blue'}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
        />
    );
};
