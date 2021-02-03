import React, { FC } from 'react';
import styles from './styles.css';
interface Props {
  label: string;
  url: string;
}

export const MenuBarItem: FC<Props> = ({ label, url }) => (
  <li className={styles.menuBarButton}>
    <a href={url}>{label}</a>
  </li>
);
