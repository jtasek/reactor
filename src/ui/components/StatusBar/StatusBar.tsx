import React, { FC } from 'react';
import styles from './styles.css';

export const StatusBar: FC = ({ children }) => <div className={styles.statusBar}>{children}</div>;
