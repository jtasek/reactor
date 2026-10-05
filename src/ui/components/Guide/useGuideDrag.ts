import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useActions, useCamera, useControls } from 'src/app/hooks';
import { RULER_SIZE_PX } from 'src/app/rulers';
import type { Orientation, Point } from 'src/app/types';
import { clientToSurface } from 'src/events/drivers/helpers';
import { tryReleasePointerCapture, trySetPointerCapture } from 'src/events/drivers/pointerCapture';

/**
 * A guide being dragged: a new one out of a ruler (`guideId` null) or an existing
 * one, `at` screen pixels from the canvas's top edge when it is horizontal and its
 * left edge when it is vertical.
 */
export type GuideDrag = { orientation: Orientation; guideId: string | null; at: number };

/** The pointer events a drag takes for itself, so the canvas starts no gesture of its own. */
const DRAG_EVENTS = ['pointermove', 'pointerup', 'pointercancel'] as const;

/**
 * Drags guides: a guide follows the pointer and is added or moved where it is
 * released, or removed when released over its ruler or beyond the canvas's edge.
 * The document changes once, on release; Escape, a canceled pointer or leaving
 * the window cancels.
 */
export function useGuideDrag() {
    const actions = useActions();
    const camera = useCamera();
    const { guides, rulers } = useControls();
    const [drag, setDrag] = useState<GuideDrag | null>(null);
    const latest = useRef({ camera, guidesShown: guides.visible, rulersShown: rulers.visible });
    const stop = useRef<(() => void) | null>(null);

    latest.current = { camera, guidesShown: guides.visible, rulersShown: rulers.visible };

    useEffect(() => () => stop.current?.(), []);

    const drop = (orientation: Orientation, guideId: string | null, at: number) => {
        const { camera: view, guidesShown, rulersShown } = latest.current;

        if (at < (rulersShown ? RULER_SIZE_PX : 0)) {
            if (guideId) {
                actions.removeGuide(guideId);
            }

            return;
        }

        const position: Point =
            orientation === 'horizontal'
                ? { x: 0, y: (at - view.position.y) / view.scale }
                : { x: (at - view.position.x) / view.scale, y: 0 };

        if (guideId) {
            actions.updateGuide({ id: guideId, position });

            return;
        }

        actions.addGuide({ orientation, position });

        if (!guidesShown) {
            actions.ui.showControl('guides');
        }
    };

    const begin = (
        event: ReactPointerEvent<SVGElement>,
        orientation: Orientation,
        guideId: string | null
    ) => {
        const surface = event.currentTarget.ownerSVGElement;

        if (event.button !== 0 || !surface || stop.current) {
            return;
        }

        event.stopPropagation();

        const { pointerId } = event;
        const along = (input: { clientX: number; clientY: number }) => {
            const point = clientToSurface(input, surface);

            return point && (orientation === 'horizontal' ? point.y : point.x);
        };
        const start = along(event);

        if (start === null) {
            return;
        }

        let at = start;

        const onPointer = (input: PointerEvent) => {
            if (input.pointerId !== pointerId) {
                return;
            }

            input.stopPropagation();
            at = along(input) ?? at;

            if (input.type === 'pointermove') {
                setDrag({ orientation, guideId, at });

                return;
            }

            stop.current?.();

            if (input.type === 'pointerup') {
                drop(orientation, guideId, at);
            }
        };

        const onKey = (input: KeyboardEvent) => {
            if (input.key === 'Escape') {
                input.stopPropagation();
                stop.current?.();
            }
        };
        const onBlur = () => stop.current?.();

        stop.current = () => {
            DRAG_EVENTS.forEach((type) => window.removeEventListener(type, onPointer, true));
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('blur', onBlur);
            tryReleasePointerCapture(surface, pointerId);
            stop.current = null;
            setDrag(null);
        };

        DRAG_EVENTS.forEach((type) => window.addEventListener(type, onPointer, true));
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('blur', onBlur);
        trySetPointerCapture(surface, pointerId);
        setDrag({ orientation, guideId, at });
    };

    return { drag, begin };
}
