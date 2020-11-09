import React, { FC } from 'react';
import styles from './styles.css';

export const NavBar: FC = ({ children }) => <ul className={styles.navBar}>{children}</ul>;
