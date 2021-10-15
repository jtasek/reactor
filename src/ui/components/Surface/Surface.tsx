import React, { FC } from 'react';

import { useKeyboard } from 'src/events/drivers/keyboard';
import { useMouse } from 'src/events/drivers/mouse';

import styles from './styles.css';

export const Surface: FC = ({ children }) => {
  useKeyboard();

  const {
    handleContextMenu,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseWheel
  } = useMouse();

  return (
    <svg
      className={styles.surface}
      preserveAspectRatio="none"
      // mouse
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleMouseWheel}
    >
      {children}
    </svg>
  );
};
