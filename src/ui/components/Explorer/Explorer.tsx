import React, { FC, ReactNode } from 'react';
import styles from './styles.css';

interface Props {
  children?: ReactNode;
}
export const Explorer: FC<Props> = ({ children }) => <div className={styles.explorer}>{children}</div>;
