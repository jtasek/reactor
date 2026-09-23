import { useCallback, useEffect, useRef } from 'react';
import type {
    MouseEvent,
    PointerEvent as ReactPointerEvent,
    PointerEventHandler,
    RefObject,
    SyntheticEvent,
    WheelEvent
} from 'react';
import { clientToSurface, getHandleTarget, screenDeltaToSurface, screenToCanvas } from './helpers';
import { useActions, useCamera, useControls, useLog } from 'src/app/hooks';
import { trySetPointerCapture, tryReleasePointerCapture } from './pointerCapture';

export const usePointerAdapter = (svgRef: RefObject<SVGSVGElement | null> | undefined) => {
    const log = useLog();
    const actions = useActions();
    const { contextMenu } = useControls();
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

    // Abandons the active gesture (if any) and releases its pointer capture.
    const cancelGesture = useCallback(() => {
        const owner = actions.events.cancelGesture();

        if (owner !== null) {
            tryReleasePointerCapture(svgRef?.current, owner);
        }
    }, [actions, svgRef]);

    useEffect(() => {
        window.addEventListener('blur', cancelGesture);

        return () => {
            window.removeEventListener('blur', cancelGesture);
            cancelGesture();
        };
    }, [cancelGesture]);

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

        const position = toCanvas(event, svgEl);

        if (!position) {
            return;
        }

        const started = actions.events.beginGesture({
            pointerId: event.pointerId,
            position,
            handle: getHandleTarget(event.target)
        });

        if (started) {
            trySetPointerCapture(svgEl, event.pointerId);
        }
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

        const position = toCanvas(event, svgEl);

        if (!position) {
            return;
        }

        actions.events.movePointer({ pointerId: event.pointerId, position });
    };

    const handlePointerUp: PointerEventHandler<SVGSVGElement> = (event) => {
        log('handlePointerUp', {
            button: event.button,
            buttons: event.buttons,
            x: event.clientX,
            y: event.clientY
        });

        const svgEl = getSvgElement(event);
        const position = svgEl ? toCanvas(event, svgEl) : null;

        // Commit before releasing capture, whose lostpointercapture would cancel.
        if (position) {
            actions.events.endGesture({ pointerId: event.pointerId, position });
        } else {
            actions.events.cancelGesture(event.pointerId);
        }

        tryReleasePointerCapture(svgEl, event.pointerId);
    };

    // The browser took the pointer away (pointercancel) or capture was lost:
    // abandon that pointer's gesture rather than committing it.
    const handlePointerInterrupted: PointerEventHandler<SVGSVGElement> = (event) => {
        actions.events.cancelGesture(event.pointerId);
        tryReleasePointerCapture(svgRef?.current, event.pointerId);
    };

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
            cancelGesture();
            actions.ui.displayContextMenu({ x: event.clientX, y: event.clientY });
        },
        [actions, cancelGesture]
    );

    return {
        handleContextMenu,
        handleMouseWheel,
        handlePointerCancel: handlePointerInterrupted,
        handleLostPointerCapture: handlePointerInterrupted,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp
    };
};
