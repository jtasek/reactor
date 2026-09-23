import { useCallback, useEffect, useRef } from 'react';
import type {
    MouseEvent,
    PointerEvent as ReactPointerEvent,
    PointerEventHandler,
    RefObject,
    SyntheticEvent,
    WheelEvent
} from 'react';
import { clientToSurface, screenDeltaToSurface, screenToCanvas } from './helpers';
import { useActions, useCamera, useControls, useEvents, useLog, useTools } from 'src/app/hooks';
import { trySetPointerCapture, tryReleasePointerCapture } from './pointerCapture';

export const usePointerAdapter = (svgRef: RefObject<SVGSVGElement | null> | undefined) => {
    const log = useLog();
    const actions = useActions();
    const { contextMenu } = useControls();
    const { pointer } = useEvents();
    const { activeToolsIds } = useTools();
    const camera = useCamera();
    const pendingPan = useRef({ dx: 0, dy: 0 });
    const panFrame = useRef<number | null>(null);

    const getSvgElement = useCallback(
        (event: SyntheticEvent<SVGSVGElement>) =>
            svgRef?.current ?? (event.currentTarget as SVGSVGElement | null),
        [svgRef]
    );

    const toCanvas = useCallback(
        (event: ReactPointerEvent<SVGSVGElement>, svgEl: SVGSVGElement) =>
            screenToCanvas(event.nativeEvent, svgEl, camera),
        [camera]
    );

    const flushPan = useCallback(() => {
        if (panFrame.current !== null) {
            cancelAnimationFrame(panFrame.current);
        }

        panFrame.current = null;

        const { dx, dy } = pendingPan.current;
        pendingPan.current = { dx: 0, dy: 0 };

        if (dx === 0 && dy === 0) {
            return;
        }

        actions.tools.panCamera({ dx, dy });
    }, [actions]);

    const schedulePan = useCallback(
        (dx: number, dy: number) => {
            pendingPan.current.dx += dx;
            pendingPan.current.dy += dy;

            if (panFrame.current !== null) {
                return;
            }

            panFrame.current = requestAnimationFrame(flushPan);
        },
        [flushPan]
    );

    useEffect(() => {
        return () => {
            if (panFrame.current !== null) {
                cancelAnimationFrame(panFrame.current);
            }

            panFrame.current = null;
            pendingPan.current = { dx: 0, dy: 0 };
        };
    }, []);

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
        [log, actions, pointer.dragging, svgRef]
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

        flushPan();

        const currentPosition = toCanvas(event, svgEl);

        if (!currentPosition) {
            return;
        }

        trySetPointerCapture(svgEl, event.pointerId);

        if (!pointer.dragging) {
            actions.events.startDragging();
        }

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
            // Pressing a shape selects it (or keeps an existing multi-selection)
            // and arms the move tool.
            const hit = actions.selectShapeAtPointer();

            if (hit) {
                actions.events.setBackground(false);
                actions.tools.activateTool('move');
                return;
            }

            // Empty canvas: a drag draws a marquee selection; a plain click
            // (zero-size marquee) deselects everything.
            actions.events.setBackground(true);

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

        if (!currentPosition) {
            return;
        }

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

            if (!svgEl) {
                return;
            }

            if (event.ctrlKey) {
                const point = clientToSurface(event, svgEl);

                if (!point) {
                    return;
                }

                flushPan();

                // Delegate to the action so the zoom is computed against the live
                // camera state, not a stale closure — this prevents drift when
                // wheel events arrive faster than React re-renders.
                actions.tools.zoomAtPoint({ point, deltaY: event.deltaY });

                return;
            }

            const delta = screenDeltaToSurface({ x: -event.deltaX, y: -event.deltaY }, svgEl);

            if (!delta) {
                return;
            }

            // Scroll-wheel pan: scrolling moves the content opposite the delta.
            schedulePan(delta.x, delta.y);
        },
        [log, actions, contextMenu.visible, getSvgElement, schedulePan, flushPan]
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
