import React, { FC, ReactNode } from 'react';

import styles from './styles.css';
import { Shape } from 'src/app/types';
import { getBoundingBox } from '../../../app/utils';
import { useActions } from 'src/app/hooks';

export interface Props {
    shape: Shape;
    children?: ReactNode;
}

const SELECTABLE_OFFSET = 0;

export const Selectable: FC<Props> = ({ shape }) => {
    const { toggleShapeSelected } = useActions();

    if (!shape.selected) {
        return null;
    }

    const box = getBoundingBox(shape);

    const x = box.topLeft.x - SELECTABLE_OFFSET;
    const y = box.topLeft.y - SELECTABLE_OFFSET;
    const width = box.width + SELECTABLE_OFFSET * 2;
    const height = box.height + SELECTABLE_OFFSET * 2;

    return (
        <rect
            x={x}
            y={y}
            height={height}
            width={width}
            className={styles.selectable}
            onClick={() => toggleShapeSelected(shape.id)}
        />
    );
};
