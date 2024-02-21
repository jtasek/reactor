import React, { FC, ReactNode } from 'react';
import styles from './styles.css';

interface Props
{
  children?: ReactNode;
}

export const Layout: FC<Props> = ({ children }) => <div className={styles.layout}>{children}</div>;
