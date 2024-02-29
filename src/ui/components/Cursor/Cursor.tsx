import React, { FC } from 'react';
import { Point } from '../../../app/types';

export interface Props {
    position: Point;
}

export const Cursor: FC<Props> = ({ position }) => (
    <div
        style={{
            color: 'black',
            position: 'absolute',
            left: `${position.x}px`,
            top: `${position.y}px`
        }}
    >
        x: {position.x}, y: {position.y}
    </div>
);
