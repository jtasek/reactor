import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useActions, useCamera, useControls, useGestureInProgress, useGuides } from 'src/app/hooks';
import { guidePlace, removesGuide, RULER_SIZE_PX } from 'src/app/rulers';
import type { Camera, Orientation } from 'src/app/types';
import { clientToSurface } from 'src/events/drivers/helpers';
import { tryReleasePointerCapture, trySetPointerCapture } from 'src/events/drivers/pointerCapture';

/**
 * A guide being dragged: a new one out of a ruler (`guideId` null) or an existing
 * one, with the pointer `pointer` screen pixels from the canvas's top edge when the
 * guide is horizontal and its left edge when vertical, on a canvas `length` long
 * along that axis.
 */
type Drag = { orientation: Orientation; guideId: string | null; pointer: number; length: number };

/** A dragged guide where it would be released: `at` screen pixels from its canvas edge. */
export type PlacedDrag = {
    orientation: Orientation;
    guideId: string | null;
    at: number;
    /** Where it would be released, in canvas units from the canvas's origin. */
    offset: number;
    /** Whether releasing it here removes it. */
    removing: boolean;
};

/** The pointer events a drag takes for itself, so the canvas starts no gesture of its own. */
const DRAG_EVENTS = ['pointermove', 'pointerup', 'pointercancel'] as const;

/**
 * The one guide drag at a time, shared by the rulers and by the guides drawn under
 * and over the shapes, and how to stop it.
 */
let current: Drag | null = null;
let stopCurrent: (() => void) | null = null;
const listeners = new Set<() => void>();

const setCurrent = (drag: Drag | null) => {
    current = drag;
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => listeners.delete(listener);
};

const takeCurrent = () => current;

const placeOnCamera = ({ orientation, pointer }: Drag, { position, scale }: Camera) =>
    guidePlace(pointer, orientation === 'horizontal' ? position.y : position.x, scale);

const placeDrag = (drag: Drag, camera: Camera, rulerSize: number): PlacedDrag => {
    const { at, offset } = placeOnCamera(drag, camera);

    return {
        orientation: drag.orientation,
        guideId: drag.guideId,
        at,
        offset,
        removing: removesGuide(at, rulerSize, drag.length)
    };
};

/**
 * Drags guides: a guide follows the pointer, on whole canvas units, and is added or
 * moved where it is released, or removed when released over its ruler or beyond
 * the canvas. The document changes once, on release; Escape, a canceled pointer or
 * leaving the window cancels, and shortcuts wait until the drag ends. No drag
 * starts during a canvas gesture or while the context menu is open.
 */
export function useGuideDrag() {
    const actions = useActions();
    const camera = useCamera();
    const guides = useGuides();
    const controls = useControls();
    const gestureInProgress = useGestureInProgress();
    const drag = useSyncExternalStore(subscribe, takeCurrent);
    const rulerSize = controls.rulers.visible ? RULER_SIZE_PX : 0;
    const latest = useRef({ camera, guides, rulerSize, guidesShown: controls.guides.visible });
    const owner = useRef(false);

    latest.current = { camera, guides, rulerSize, guidesShown: controls.guides.visible };

    useEffect(
        () => () => {
            if (owner.current) {
                stopCurrent?.();
            }
        },
        []
    );

    const drop = (released: Drag) => {
        const { camera: view, guides: present, rulerSize: edge, guidesShown } = latest.current;
        const { orientation, guideId } = released;
        const { offset, at } = placeOnCamera(released, view);

        // Another copy removed it meanwhile.
        if (guideId !== null && !present[guideId]) {
            return;
        }

        if (removesGuide(at, edge, released.length)) {
            if (guideId !== null) {
                actions.removeGuide(guideId);
            }

            return;
        }

        const position = orientation === 'horizontal' ? { x: 0, y: offset } : { x: offset, y: 0 };

        if (guideId !== null) {
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

        if (
            event.button !== 0 ||
            !surface ||
            stopCurrent ||
            gestureInProgress ||
            controls.contextMenu.visible
        ) {
            return;
        }

        const { pointerId } = event;
        const bounds = surface.getBoundingClientRect();
        const along = (input: { clientX: number; clientY: number }) => {
            const point = clientToSurface(input, surface);

            return point && (orientation === 'horizontal' ? point.y : point.x);
        };
        const start = along(event);

        if (start === null) {
            return;
        }

        event.stopPropagation();

        const length = orientation === 'horizontal' ? bounds.height : bounds.width;

        const onPointer = (input: PointerEvent) => {
            if (input.pointerId !== pointerId || !current) {
                return;
            }

            input.stopPropagation();

            const moved = { ...current, pointer: along(input) ?? current.pointer };

            if (input.type === 'pointermove') {
                setCurrent(moved);

                return;
            }

            stopCurrent?.();

            if (input.type === 'pointerup') {
                drop(moved);
            }
        };

        const onKey = (input: KeyboardEvent) => {
            input.stopPropagation();

            if (input.key === 'Escape') {
                stopCurrent?.();
            }
        };

        const onBlur = () => stopCurrent?.();

        stopCurrent = () => {
            DRAG_EVENTS.forEach((type) => window.removeEventListener(type, onPointer, true));
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('blur', onBlur);
            tryReleasePointerCapture(surface, pointerId);
            stopCurrent = null;
            owner.current = false;
            setCurrent(null);
        };

        DRAG_EVENTS.forEach((type) => window.addEventListener(type, onPointer, true));
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('blur', onBlur);
        trySetPointerCapture(surface, pointerId);
        owner.current = true;
        setCurrent({ orientation, guideId, pointer: start, length });
    };

    return { drag: drag && placeDrag(drag, camera, rulerSize), begin };
}
