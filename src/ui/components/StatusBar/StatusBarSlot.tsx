import React, { FC } from 'react';
import styles from './styles.css';

interface Props {
  name: string;
}

export const StatusBarSlot: FC<Props> = ({ name, children }) => (
  <span id={name} className={styles.statusBarSlot}>
    {children}
  </span>
);
