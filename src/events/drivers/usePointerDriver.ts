import { useState, PointerEvent, WheelEvent, MouseEvent } from 'react';
import { useActions } from 'src/app/hooks';

const ZERO_DISTANCE = 0;

export const usePointerDriver = () => {
  const [dragging, setDragging] = useState(false);
  const [lastDistance, setLastDistance] = useState(ZERO_DISTANCE);

  const actions = useActions();

  const handlePointerMove = (event: PointerEvent) => {
    console.log('pointer move');

    if (dragging) {
      actions.events.dragging({ x: event.clientX, y: event.clientY });
    }
  };

  const handleTouchStart = (event: any) => {
    console.log('touch start');

    if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];

      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      setLastDistance(currentDistance);
    }
  };

  const handleTouchMove = (event: any) => {
    console.log('touch move');
    event.stopProgration();
    event.preventDefault();

    if (event.touches.length === 2) {
      console.log(event.touches.length);
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];

      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      if (lastDistance > currentDistance) {
        actions.tools.zoomIn();
      } else {
        actions.tools.zoomOut();
      }

      setLastDistance(currentDistance);
    }
  };

  const handleTouchEnd = (event: any) => {
    console.log('touch end');

    setLastDistance(ZERO_DISTANCE);
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (dragging) {
      setDragging(false);
      actions.events.endDragging({ x: event.clientX, y: event.clientY });
      actions.tools.executeToolCommands();
      setLastDistance(ZERO_DISTANCE);
      // actions.tools.resetTools();
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    setDragging(true);
    actions.events.startDragging({ x: event.clientX, y: event.clientY });
  };

  const handleMouseWheel = (event: WheelEvent) => {
    event.preventDefault();

    if (event.ctrlKey) {
      if (Math.max(event.deltaX, event.deltaY) > 0) {
        actions.tools.zoomOut();
      } else {
        actions.tools.zoomIn();
      }

      return;
    }

    actions.tools.moveCamera({ deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ });
  };

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    actions.ui.displayContextMenu({ x: event.clientX, y: event.clientY });
  };

  return {
    handleContextMenu,
    handleMouseWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart
  };
};
