import { useState } from 'react';
import { useActions } from 'src/app/hooks';

export const useMouse = () => {
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
      actions.tools.executeToolCommands();
      actions.tools.resetTools();
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

  return {
    handleContextMenu,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseWheel
  };
};
