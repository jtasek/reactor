import { useState, PointerEvent, WheelEvent, MouseEvent } from 'react';
import { useActions } from 'src/app/hooks';

export const usePointerDriver = () => {
  const [dragging, setDragging] = useState(false);
  const actions = useActions();

  const handlePointerMove = (event: PointerEvent) => {
    if (dragging) {
      actions.events.dragging({ x: event.clientX, y: event.clientY });
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (dragging) {
      setDragging(false);
      actions.events.endDragging({ x: event.clientX, y: event.clientY });
      actions.tools.executeToolCommands();
      // actions.tools.resetTools();
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    setDragging(true);
    actions.events.startDragging({ x: event.clientX, y: event.clientY });
  };

  const handleMouseWheel = (event: WheelEvent) => {
    actions.tools.moveCamera({ deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ });
  };

  const handleContextMenu = (event: MouseEvent) => {
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
