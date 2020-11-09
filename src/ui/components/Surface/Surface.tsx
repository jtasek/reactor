import React, { FC } from 'react';
import { useActions } from 'src/app/hooks';

import styles from './styles.css';

export const Surface: FC = ({ children }) => {
  const { displayContextMenu } = useActions().ui;

  return (
    <svg
      className={styles.surface}
      onContextMenu={(e) => {
        e.preventDefault();
        displayContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {children}
    </svg>
  );
};
