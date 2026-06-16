import { useCallback } from 'react';
import type {
    MouseEvent,
    PointerEvent as ReactPointerEvent,
    PointerEventHandler,
    RefObject,
    SyntheticEvent,
    WheelEvent
} from 'react';
import { scaleDown, scaleUp } from 'src/tools/actions';
import { screenToCanvas } from './helpers';
import { useActions, useCamera, useControls, useEvents, useLog, useTools } from 'src/app/hooks';
import { zoomAt } from './cameraMath';
import { trySetPointerCapture, tryReleasePointerCapture } from './pointerCapture';

export const usePointerAdapter = (svgRef: RefObject<SVGSVGElement | null> | undefined) => {
    const log = useLog();
    const actions = useActions();
    const { contextMenu } = useControls();
    const { pointer } = useEvents();
    const { activeToolsIds } = useTools();
    const { scale, position } = useCamera();

    const getSvgElement = useCallback(
        (event: SyntheticEvent<SVGSVGElement>) =>
            svgRef?.current ?? (event.currentTarget as SVGSVGElement | null),
        [svgRef]
    );

    const toCanvas = useCallback(
        (event: ReactPointerEvent<SVGSVGElement>, svgEl: SVGSVGElement) =>
            screenToCanvas(event.nativeEvent, svgEl, scale, position),
        [scale, position]
    );

    const completePointerInteraction = useCallback(
        (event: ReactPointerEvent<SVGSVGElement>) => {
            log('handlePointerUp', {
                button: event.button,
                buttons: event.buttons,
                x: event.clientX,
                y: event.clientY
            });

            tryReleasePointerCapture(svgRef?.current, event.pointerId);

            if (pointer.dragging) {
                actions.events.endDragging();
                actions.tools.executeToolCommands();
                actions.tools.resetTools();
            }
        },
        [log, actions, svgRef]
    );

    const handlePointerDown: PointerEventHandler<SVGSVGElement> = (event) => {
        log('handlePointerDown', {
            button: event.button,
            buttons: event.buttons,
            x: event.clientX,
            y: event.clientY
        });

        if (contextMenu.visible) {
            return;
        }

        if (event.buttons !== 1) {
            return;
        }

        const svgEl = getSvgElement(event);
        if (!svgEl) {
            return;
        }

        trySetPointerCapture(svgEl, event.pointerId);

        if (!pointer.dragging) {
            actions.events.startDragging();
        }

        const currentPosition = toCanvas(event, svgEl);

        actions.events.resetDragging();
        actions.events.setStartPosition(currentPosition);
        actions.events.setCurrentPosition(currentPosition);

        // A resize handle owns its own pointer interaction; leave selection and
        // tools untouched so the Resizable can drive the resize.
        const target = event.target as Element | null;
        if (target?.closest?.('[data-handle]')) {
            actions.events.setBackground(false);
            return;
        }

        const activeToolId = activeToolsIds[0];

        if (activeToolId === 'select') {
            // In select mode a press either grabs the shape under the pointer
            // (selecting it and arming the move tool) or, on empty canvas,
            // clears the selection and arms a marquee select.
            const hit = actions.selectShapeAtPointer();

            if (hit) {
                actions.events.setBackground(false);
                actions.tools.activateTool('move');
            } else {
                actions.events.setBackground(true);
            }

            return;
        }

        // A drawing tool is active: draw regardless of what is under the pointer.
        actions.events.setBackground(false);
    };

    const handlePointerMove: PointerEventHandler<SVGSVGElement> = (event) => {
        log('handlePointerMove', {
            button: event.button,
            buttons: event.buttons,
            x: event.clientX,
            y: event.clientY
        });

        if (contextMenu.visible) {
            return;
        }

        const svgEl = getSvgElement(event);
        if (!svgEl) {
            return;
        }

        const currentPosition = toCanvas(event, svgEl);

        actions.events.updateCurrentPosition(currentPosition);
    };

    const handlePointerEnd: PointerEventHandler<SVGSVGElement> = useCallback(
        (event) => {
            if (contextMenu.visible) {
                return;
            }
            completePointerInteraction(event);
        },
        [contextMenu.visible, completePointerInteraction]
    );

    const handleMouseWheel = useCallback(
        (event: WheelEvent<SVGSVGElement>) => {
            log('handleMouseWheel', event.deltaX, event.deltaY);

            if (contextMenu.visible) {
                return;
            }

            const svgEl = getSvgElement(event);
            if (!svgEl) return;

            if (event.ctrlKey) {
                const rect = svgEl.getBoundingClientRect();
                const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };

                const newScale = event.deltaY > 0 ? scaleDown(scale) : scaleUp(scale);
                const camera = zoomAt({ position, scale }, newScale, screenPoint);

                const delta = {
                    deltaX: camera.position.x,
                    deltaY: camera.position.y,
                    deltaZ: 0
                };

                actions.tools.zoom({ scale: newScale, delta });
                return;
            }

            actions.tools.moveCamera({ deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: 0 });
        },
        [log, actions, scale, position, contextMenu.visible, getSvgElement]
    );

    const handleContextMenu = useCallback(
        (event: MouseEvent<SVGSVGElement>) => {
            event.preventDefault();

            if (pointer.dragging) {
                actions.events.endDragging();
            }

            actions.ui.displayContextMenu({ x: event.clientX, y: event.clientY });
        },
        [actions, pointer.dragging]
    );

    return {
        handleContextMenu,
        handleMouseWheel,
        handlePointerCancel: handlePointerEnd,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp: handlePointerEnd
    };
};
