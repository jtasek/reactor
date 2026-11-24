import React, { FC, ReactNode } from 'react';
import styles from './styles.css';

export const StatusBar: FC<{ children?: ReactNode }> = ({ children }) => (
    <div className={styles.statusBar}>{children}</div>
);
