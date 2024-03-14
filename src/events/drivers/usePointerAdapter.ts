import { useState, MouseEvent } from 'react';
import { useActions, useControls, useLog } from 'src/app/hooks';

const ZERO_DISTANCE = 0;
const LEFT_BUTTON = 1;
const RIGHT_BUTTON = 2;
const LEFT_AND_RIGHT_BUTTON = 3;

export const usePointerAdapter = () => {
    const log = useLog();

    let pointerDown = false;
    let isDragging = false;
    const [lastDistance, setLastDistance] = useState(ZERO_DISTANCE);

    const actions = useActions();
    const { contextMenu } = useControls();

    const handleTouchStart = (event) => {
        log('handleTouchStart');

        if (event.touches.length === 2) {
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];

            const currentDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
            );

            setLastDistance(currentDistance);
        }
    };

    const handleTouchMove = (event) => {
        log('handleTouchMove');
        event.preventDefault();

        if (event.touches.length === 2) {
            log(event.touches.length);
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];

            const currentDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
            );

            if (lastDistance > currentDistance) {
                actions.tools.zoomIn();
            } else {
                actions.tools.zoomOut();
            }

            setLastDistance(currentDistance);
        }
    };

    const handleTouchEnd = (event) => {
        log('handleTouchEnd');

        setLastDistance(ZERO_DISTANCE);
    };

    const handlePointerDown = (event) => {
        if (contextMenu.visible) {
            return;
        }

        log('handlePointerDown', {
            button: event.button,
            buttons: event.buttons,
            x: event.clientX,
            y: event.clientY
        });

        pointerDown = true;
        actions.events.setStartPosition({ x: event.clientX, y: event.clientY });
        actions.events.setCurrentPosition({ x: event.clientX, y: event.clientY });
    };

    const handlePointerMove = (event) => {
        log('handlePointerMove', {
            button: event.button,
            buttons: event.buttons,
            x: event.clientX,
            y: event.clientY
        });

        if (pointerDown && !isDragging) {
            isDragging = true;
            actions.events.startDragging();
        }

        if (isDragging) {
            actions.events.updateCurrentPosition({ x: event.clientX, y: event.clientY });
        }
    };

    const handlePointerUp = (event) => {
        log('handlePointerUp', {
            button: event.button,
            buttons: event.buttons,
            x: event.clientX,
            y: event.clientY
        });

        if (isDragging) {
            isDragging = false;
            actions.events.endDragging({ x: event.clientX, y: event.clientY });
        } else {
            actions.unselectShapes();
        }

        if (pointerDown) {
            pointerDown = false;
            actions.tools.executeToolCommands();
            setLastDistance(ZERO_DISTANCE);
        }
    };

    const handleMouseWheel = (event) => {
        log('handleMouseWheel', event.deltaX, event.deltaY);

        if (event.ctrlKey) {
            if (Math.max(event.deltaX, event.deltaY) > 0) {
                actions.tools.zoomOut();
            } else {
                actions.tools.zoomIn();
            }

            return;
        }

        actions.tools.moveCamera({
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaZ: event.deltaZ
        });
    };

    const handleContextMenu = (event) => {
        log('handleContextMenu');

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
