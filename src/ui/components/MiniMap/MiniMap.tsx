import React, { FC, ReactNode } from 'react';
import styles from './styles.css';

import { Size } from 'src/app/types';

export interface Props {
    size: Size;
    viewBox: string;
    children?: ReactNode;
}

export const MiniMap: FC<Props> = ({ size, viewBox, children }) => (
    <svg
        className={styles.minimap}
        width={size.width}
        height={size.height}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
    >
        {children}
    </svg>
);
