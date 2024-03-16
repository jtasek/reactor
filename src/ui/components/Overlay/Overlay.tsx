import React, { FC } from 'react';
import styles from './styles.css';

export const Overlay: FC = () => (
    <g>
        <defs>
            <filter id="overlay" width="110%" height="100%">
                <feGaussianBlur stdDeviation="5" result="blur" />
            </filter>
        </defs>
        <rect className={styles.overlay} fill="url(#overlay)" />
    </g>
);
