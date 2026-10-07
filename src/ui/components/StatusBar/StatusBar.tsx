import React, { CSSProperties, FC, ReactNode } from 'react';
import styles from './styles.css';

interface Props {
    slots: number;
    children?: ReactNode;
}

export const StatusBar: FC<Props> = ({ slots, children }) => (
    <div className={styles.statusBar} style={{ '--status-bar-slots': slots } as CSSProperties}>
        {children}
    </div>
);
