import React, { FC } from 'react';
import styles from './styles.css';

export const Layout: FC = ({ children }) => <div className={styles.layout}>{children}</div>;
