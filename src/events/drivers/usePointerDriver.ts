import { useState, PointerEvent, WheelEvent, MouseEvent } from 'react';
import { useActions, useControls } from 'src/app/hooks';

const ZERO_DISTANCE = 0;

export const usePointerDriver = () => {
  console.log('usePointerDriver');
  let dragging = false;
  const [lastDistance, setLastDistance] = useState(ZERO_DISTANCE);

  const actions = useActions();
  const contextMenu = useControls().contextMenu;

  const handleTouchStart = (event: any) => {
    console.log('handleTouchStart');

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
    console.log('handleTouchMove');
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
    console.log('handleTouchEnd');

    setLastDistance(ZERO_DISTANCE);
  };

  const handlePointerDown = (event: PointerEvent) => {
    console.log('handlePointerDown', dragging);

    dragging = true;
    actions.events.startDragging({ x: event.clientX, y: event.clientY });
  };

  const handlePointerMove = (event: PointerEvent) => {
    console.log('handlePointerMove', dragging);

    if (dragging) {
      actions.events.dragging({ x: event.clientX, y: event.clientY });
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    console.log('handlePointerUp', dragging);
    if (dragging) {
      dragging = false;
      actions.events.endDragging({ x: event.clientX, y: event.clientY });
      actions.tools.executeToolCommands();
      actions.tools.resetTools();
      setLastDistance(ZERO_DISTANCE);
    }
  };

  const handleMouseWheel = (event: WheelEvent) => {
    console.log('handleMouseWheel');
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
    console.log('handleContextMenu');

    event.preventDefault();
    if (contextMenu.visible) return;

    actions.ui.displayContextMenu();
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
