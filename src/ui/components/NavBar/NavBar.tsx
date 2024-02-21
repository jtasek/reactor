import React, { FC, ReactNode } from 'react';
import styles from './styles.css';

interface Props {
  children?: ReactNode;
}

export const NavBar: FC<Props> = ({ children }) => <ul className={styles.navBar}>{children}</ul>;
