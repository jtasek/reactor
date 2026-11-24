import React, { type FC, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import styles from './styles.css';

/** Says what failed, in the error colour; place it just above the action that failed. */
export const Problem: FC<{ children: ReactNode }> = ({ children }) => (
    <p role="alert" className={styles.problem}>
        <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
        {children}
    </p>
);
