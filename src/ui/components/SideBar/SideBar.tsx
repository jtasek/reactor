import React, { FC } from 'react';
import styles from './styles.css';

export const SideBar: FC = ({ children }) => <div className={styles.sidebar}>{children}</div>;
