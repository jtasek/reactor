import React, { FC } from 'react';
import styles from './styles.css';

export interface Props {
    sources: string[];
}

export const DataView: FC<Props> = ({ sources }) => (
    <div className={styles.dataView}>Data sources: {sources.concat(', ')}</div>
);
