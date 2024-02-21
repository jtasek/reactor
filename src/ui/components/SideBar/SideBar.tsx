import React, { FC, ReactNode } from 'react';
import styles from './styles.css';

interface Props {
  children?: ReactNode;
}

export const SideBar: FC<Props> = ({ children }) => <div className={styles.sidebar}>{children}</div>;
