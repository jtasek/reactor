import { useState } from 'react';
import { useActions } from 'src/app/hooks';

export const usePointer = () => {
  const [dragging, setDragging] = useState(false);
  const actions = useActions();

  const handlePointerMove = (event) => {
    if (dragging) {
      actions.events.dragging({ x: event.clientX, y: event.clientY });
    }
  };

  const handlePointerUp = (event) => {
    if (dragging) {
      setDragging(false);
      actions.tools.executeToolCommands();
      actions.tools.resetTools();
      actions.events.endDragging();
    }
  };

  const handlePointerDown = (event) => {
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

  return {
    handleContextMenu,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleMouseWheel
  };
};
