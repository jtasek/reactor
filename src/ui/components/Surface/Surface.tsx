import React, { FC } from 'react';

import { usePointerDriver } from 'src/events/drivers/usePointerDriver';

import styles from './styles.css';

export const Surface: FC = ({ children }) => {
  const {
    handleContextMenu,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleMouseWheel
  } = usePointerDriver();

  return (
    <svg
      className={styles.surface}
      preserveAspectRatio="none"
      // mouse
      onContextMenu={handleContextMenu}
      onWheel={handleMouseWheel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      // onPointerLeave={handlePointerUp}
    >
      {children}
    </svg>
  );
};
