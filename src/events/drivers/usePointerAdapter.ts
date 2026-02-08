import React, { useRef, PointerEventHandler, RefObject, useCallback } from 'react';
import { useActions, useCamera, useControls, useLog } from 'src/app/hooks';
import { limitScale, scaleDown, scaleUp } from 'src/tools/actions';
import { dist, midpoint, screenToCanvas } from './helpers';
import { zoomAt } from './cameraMath';

export const usePointerAdapter = (svgRef: RefObject<SVGSVGElement | null> | undefined) => {
    const log = useLog();

    const pointerDown = useRef(false);
    const isDragging = useRef(false);
    const pointers = useRef<Map<number, PointerEvent>>(new Map());
    const pinchState = useRef<{
        startDist: number;
        startScale: number;
        center: { x: number; y: number };
    } | null>(null);

    const actions = useActions();
    const { contextMenu } = useControls();
    const { scale, position } = useCamera();

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

        if (!svgRef?.current) {
            return;
        }

        const offset = { x: position.x, y: position.y };

        try {
            svgRef.current.setPointerCapture(event.pointerId);
        } catch {
            // ignore if capture not available
        }

        pointers.current.set(event.pointerId, event.nativeEvent);

        if (pointers.current.size === 2) {
            const [a, b] = Array.from(pointers.current.values());
            pinchState.current = {
                startDist: dist(a, b),
                startScale: scale,
                center: midpoint(a, b)
            };
        }

        const currentPosition = screenToCanvas(event.nativeEvent, svgRef.current, scale, offset);

        pointerDown.current = true;
        actions.events.setStartPosition(currentPosition);
        actions.events.setCurrentPosition(currentPosition);
    };

    const handlePointerMove: PointerEventHandler<SVGSVGElement> = useCallback(
        (event) => {
            log('handlePointerMove', {
                button: event.button,
                buttons: event.buttons,
                x: event.clientX,
                y: event.clientY
            });

            if (!svgRef?.current) {
                return;
            }

            // update stored pointer for this id so pinch calculations use latest positions
            pointers.current.set(event.pointerId, event.nativeEvent);

            const offset = { x: position.x, y: position.y };

            if (pinchState.current && pointers.current.size === 2) {
                const [a, b] = Array.from(pointers.current.values());
                const currentDist = dist(a, b);
                if (pinchState.current.startDist > 0) {
                    const newScale = limitScale(
                        pinchState.current.startScale * (currentDist / pinchState.current.startDist)
                    );

                    const svgEl = svgRef.current;
                    const rect = svgEl.getBoundingClientRect();
                    const center = midpoint(a, b);
                    const screenPoint = { x: center.x - rect.left, y: center.y - rect.top };
                    const camera = zoomAt({ position, scale }, newScale, screenPoint);

                    actions.tools.zoom({
                        scale: camera.scale,
                        delta: { deltaX: camera.position.x, deltaY: camera.position.y, deltaZ: 0 }
                    });
                }
                return;
            }

            if (pointerDown.current && !isDragging.current) {
                isDragging.current = true;
                actions.events.startDragging();
            }

            if (isDragging.current) {
                const currentPosition = screenToCanvas(
                    event.nativeEvent,
                    svgRef.current,
                    scale,
                    offset
                );
                actions.events.updateCurrentPosition(currentPosition);
            }
        },
        [log, actions, svgRef, scale, position]
    );

    const handlePointerUp: PointerEventHandler<SVGSVGElement> = useCallback(
        (event) => {
            log('handlePointerUp', {
                button: event.button,
                buttons: event.buttons,
                x: event.clientX,
                y: event.clientY
            });

            try {
                svgRef?.current?.releasePointerCapture(event.pointerId);
            } catch {
                // ignore if release not available
            }

            pointers.current.delete(event.pointerId);
            if (pointers.current.size < 2) {
                pinchState.current = null;
            }

            if (isDragging.current) {
                isDragging.current = false;
                actions.events.endDragging();
            } else {
                actions.unselectShapes();
            }

            if (pointerDown.current) {
                pointerDown.current = false;

                // only finish tool action when there are no more pointers down (so a 2-finger pan won't
                // trigger tool execution when one finger is lifted)
                if (pointers.current.size === 0) {
                    actions.tools.executeToolCommands();
                    actions.tools.resetTools();
                }
            }
        },
        [log, actions, svgRef]
    );

    const handleMouseWheel = useCallback(
        (event: React.WheelEvent<SVGSVGElement>) => {
            log('handleMouseWheel', event.deltaX, event.deltaY);

            if (contextMenu.visible) {
                return;
            }

            const svgEl = svgRef?.current ?? (event.currentTarget as SVGSVGElement);
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
        [log, actions, scale, position, contextMenu, svgRef]
    );

    const handleContextMenu = (event: React.MouseEvent<SVGSVGElement>) => {
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
        handlePointerUp
    };
};
