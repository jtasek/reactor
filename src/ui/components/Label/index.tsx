import React, { FC } from 'react';

import styles from './styles.css';
import { Shape } from '../../../app/types';
import { getBoundingBox } from '../../../app/utils';

const LABEL_OFFSET = 20;

interface Props {
    shape: Shape;
}
export const Label: FC<Props> = ({ shape }) => {
    if (!shape.selected) {
        return null;
    }

    const box = getBoundingBox(shape);

    const middleBottom = {
        x: box.bottomRight.x - box.width / 2,
        y: box.bottomRight.y + LABEL_OFFSET
    };
    const width = Math.round(box.width);
    const height = Math.round(box.height);

    return (
        <text className={styles.label} x={middleBottom.x} y={middleBottom.y} textAnchor="middle">
            {`${width} x ${height}`}
        </text>
    );
};
