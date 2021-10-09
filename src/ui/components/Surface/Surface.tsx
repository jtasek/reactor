import React, { FC, useState } from 'react';
import { useActions } from 'src/app/hooks';

import styles from './styles.css';

export const Surface: FC = ({ children }) => {
  const [dragging, setDragging] = useState(false);

  const actions = useActions();

  const handleMouseMove = (event) => {
    if (dragging) {
      actions.events.dragging({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseUp = (event) => {
    if (dragging) {
      setDragging(false);
      actions.tools.executeToolCommand();
      actions.events.endDragging();
    }
  };

  const handleMouseDown = (event) => {
    setDragging(true);
    actions.events.startDragging({ x: event.clientX, y: event.clientY });
  };

  const handleMouseWheel = (event) => {
    actions.tools.moveCamera({ deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ });
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    actions.ui.displayContextMenu({ x: event.clientX, y: event.clientY });
  };

  return (
    <svg
      className={styles.surface}
      preserveAspectRatio="none"
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
