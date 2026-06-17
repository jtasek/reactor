import React, { FC } from 'react';

import styles from './styles.css';
import { Shape } from 'src/app/types';
import { getShapeBounds } from '../../../app/utils';

export interface Props {
    shape: Shape;
}

export const Active: FC<Props> = ({ shape }) => {
    const box = getShapeBounds(shape);

    return (
        <rect
            x={box.topLeft.x}
            y={box.topLeft.y}
            height={box.height}
            width={box.width}
            className={styles.active}
        />
    );
};
