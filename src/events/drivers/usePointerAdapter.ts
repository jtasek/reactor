import { useCallback, useEffect, useRef } from 'react';
import type {
    MouseEvent,
    PointerEvent as ReactPointerEvent,
    PointerEventHandler,
    RefObject,
    SyntheticEvent,
    TouchEvent
} from 'react';
import { clientToSurface, getHandleTarget, screenDeltaToSurface, screenToCanvas } from './helpers';
import { useActions, useCamera, useControls, useLog } from 'src/app/hooks';
import type { TouchContact } from 'src/events/types';
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

        const delta = screenDeltaToSurface({ x: dx, y: dy }, svgRef?.current ?? null);

        if (delta) {
            actions.tools.panCamera({ dx: delta.x, dy: delta.y });
        }
    }, [actions, svgRef]);

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
            handle: getHandleTarget(event.target),
            touch: event.pointerType === 'touch'
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

    // Touch Events carry the full contact list a pinch needs; single-contact
    // drags still go through the Pointer Events handlers above.
    const toContacts = (event: TouchEvent<SVGSVGElement>): TouchContact[] => {
        const svgEl = getSvgElement(event);

        return Array.from(event.touches).flatMap((touch) => {
            const point = clientToSurface(touch, svgEl);

            return point ? [{ id: touch.identifier, point }] : [];
        });
    };

    const handleTouchStart = (event: TouchEvent<SVGSVGElement>) => {
        if (contextMenu.visible || event.touches.length < 2) {
            return;
        }

        actions.events.beginPinch(toContacts(event));
    };

    const handleTouchMove = (event: TouchEvent<SVGSVGElement>) => {
        actions.events.updatePinch(toContacts(event));
    };

    const handleTouchEnd = (event: TouchEvent<SVGSVGElement>) => {
        actions.events.endPinch(event.touches.length);
    };

    const handleMouseWheel = useCallback(
        (event: WheelEvent) => {
            // React's wheel listeners are passive. Cancel on the surface's native
            // listener so trackpad panning cannot navigate browser history.
            if (event.cancelable) {
                event.preventDefault();
            }

            log('handleMouseWheel', event.deltaX, event.deltaY);

            if (contextMenu.visible) {
                return;
            }

            const svgEl = svgRef?.current;

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

            if (!Number.isFinite(event.deltaX) || !Number.isFinite(event.deltaY)) {
                return;
            }

            // Collect screen deltas here; read the SVG matrix once in the frame,
            // instead of forcing a layout read for every trackpad event.
            schedulePan(-event.deltaX, -event.deltaY);
        },
        [log, actions, contextMenu.visible, svgRef, schedulePan, flushPan]
    );

    useEffect(() => {
        const svgEl = svgRef?.current;

        svgEl?.addEventListener('wheel', handleMouseWheel, { passive: false });

        return () => svgEl?.removeEventListener('wheel', handleMouseWheel);
    }, [svgRef, handleMouseWheel]);

    const handleContextMenu = useCallback(
        (event: MouseEvent<SVGSVGElement>) => {
            event.preventDefault();
            cancelGesture();
            actions.ui.displayContextMenu({ x: event.clientX, y: event.clientY });
        },
        [actions, cancelGesture]
    );

    // The release before it left the pointer where the shape was double-clicked.
    const handleDoubleClick = useCallback(() => {
        actions.enterGroupAtPointer();
    }, [actions]);

    return {
        handleContextMenu,
        handleDoubleClick,
        handlePointerCancel: handlePointerInterrupted,
        handleLostPointerCapture: handlePointerInterrupted,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleTouchCancel: handleTouchEnd,
        handleTouchEnd,
        handleTouchMove,
        handleTouchStart
    };
};
