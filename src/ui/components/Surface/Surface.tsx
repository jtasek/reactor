import React, { FC, ReactNode } from 'react';

import styles from './styles.css';

interface Props {
    children?: ReactNode;
}
export const Surface: FC<Props> = ({ children }) => (
    <svg className={styles.surface} preserveAspectRatio="none">
        {children}
    </svg>
);
