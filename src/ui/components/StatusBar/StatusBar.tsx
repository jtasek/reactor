import React, { FC, ReactNode } from 'react';
import styles from './styles.css';

interface Props {
  children?: ReactNode;}

export const StatusBar: FC<Props> = ({ children }) => <div className={styles.statusBar}>{children}</div>;
