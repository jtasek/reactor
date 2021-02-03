import React, { FC } from 'react';
import { MenuBarItem } from './MenuBarItem';

import styles from './styles.css';

export interface Props {
  actions: { label: string; url: string }[];
}

export const MenuBar: FC<Props> = ({ actions }) => (
  <ul className={styles.menuBar}>
    {actions.map((action) => (
      <MenuBarItem key={action.label} label={action.label} url={action.url} />
    ))}
  </ul>
);
