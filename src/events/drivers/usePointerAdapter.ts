import { useCallback, useRef } from 'react';
import type {
    MouseEvent,
    PointerEvent as ReactPointerEvent,
    PointerEventHandler,
    RefObject,
    SyntheticEvent,
    WheelEvent
} from 'react';
import { screenToCanvas } from './helpers';
import { useActions, useCamera, useControls, useEvents, useLog, useTools } from 'src/app/hooks';
import { trySetPointerCapture, tryReleasePointerCapture } from './pointerCapture';

export const usePointerAdapter = (svgRef: RefObject<SVGSVGElement | null> | undefined) => {
    const log = useLog();
    const actions = useActions();
    const { contextMenu } = useControls();
    const { pointer } = useEvents();
    const { activeToolsIds } = useTools();
    const { scale, position } = useCamera();

    // Tracks an in-progress empty-canvas pan. `moved` distinguishes a pan (drag)
    // from a plain click, which deselects on release.
    const pan = useRef<{
        origin: { x: number; y: number };
        last: { x: number; y: number };
        moved: boolean;
    } | null>(null);

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

            // Finalize an empty-canvas interaction: a click (no pan movement)
            // deselects; a pan leaves the selection alone.
            if (pan.current) {
                if (!pan.current.moved) {
                    actions.unselectShapes();
                }
                pan.current = null;
            }

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
            // Pressing a shape selects it (or keeps an existing multi-selection)
            // and arms the move tool.
            const hit = actions.selectShapeAtPointer();

            if (hit) {
                actions.events.setBackground(false);
                actions.tools.activateTool('move');
                return;
            }

            // Empty canvas: Shift-drag draws a marquee, a plain drag pans the
            // canvas (selection preserved), and a plain click deselects on
            // release.
            if (event.shiftKey) {
                actions.events.setBackground(true);
            } else {
                actions.events.setBackground(false);
                pan.current = {
                    origin: { x: event.clientX, y: event.clientY },
                    last: { x: event.clientX, y: event.clientY },
                    moved: false
                };
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

        // Pan the canvas by the incremental screen delta while dragging empty
        // canvas. The svg uses a 1:1 pixel coordinate space, so the client-space
        // delta maps directly to the camera translation.
        if (pan.current) {
            const dx = event.clientX - pan.current.last.x;
            const dy = event.clientY - pan.current.last.y;

            if (dx !== 0 || dy !== 0) {
                actions.tools.panCamera({ dx, dy });
                pan.current.last = { x: event.clientX, y: event.clientY };
            }

            const totalX = event.clientX - pan.current.origin.x;
            const totalY = event.clientY - pan.current.origin.y;
            if (Math.hypot(totalX, totalY) > 3) {
                pan.current.moved = true;
            }
        }
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
                const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };

                // Delegate to the action so the zoom is computed against the live
                // camera state, not a stale closure — this prevents drift when
                // wheel events arrive faster than React re-renders.
                actions.tools.zoomAtPoint({ point, deltaY: event.deltaY });
                return;
            }

            // Scroll-wheel pan: scrolling moves the content opposite the delta.
            actions.tools.panCamera({ dx: -event.deltaX, dy: -event.deltaY });
        },
        [log, actions, contextMenu.visible, getSvgElement]
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
