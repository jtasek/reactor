import { guideIntersections } from 'src/app/guideIntersections';
import { readGuideOutlines } from './guideOutlines';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
    useActions,
    useCamera,
    useControls,
    useCurrentDocumentId,
    useDocumentLocked,
    useGestureInProgress,
    useGuides
} from 'src/app/hooks';
import {
    guideLabelPlace,
    guidePlace,
    removesGuide,
    RULER_SIZE_PX,
    type GuideLabelPlace
} from 'src/app/rulers';
import type { Camera, Orientation, Point } from 'src/app/types';
import { clientToSurface } from 'src/events/drivers/helpers';
import { tryReleasePointerCapture, trySetPointerCapture } from 'src/events/drivers/pointerCapture';
import { beyondClickSlip } from 'src/events/gestures';

/**
 * A guide being dragged: a new one out of a ruler (`guideId` null) or an existing
 * one, with the pointer `pointer` screen pixels from the canvas's top edge when the
 * guide is horizontal and its left edge when vertical, and `across` pixels along
 * the guide, on a canvas `bounds` big and `length` long along the guide's axis.
 */
type Drag = {
    orientation: Orientation;
    guideId: string | null;
    pointer: number;
    across: number;
    length: number;
    bounds: { width: number; height: number };
    marks: Point[];
};

/** A dragged guide where it would be released: `at` screen pixels from its canvas edge. */
export type PlacedDrag = {
    marks: Point[];
    orientation: Orientation;
    guideId: string | null;
    at: number;
    /** Where it would be released, in canvas units from the canvas's origin. */
    offset: number;
    /** Whether releasing it here removes it. */
    removing: boolean;
    /** Where its position is shown, beside the pointer. */
    label: GuideLabelPlace;
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

const placeOnCamera = (
    { orientation, pointer }: Pick<Drag, 'orientation' | 'pointer'>,
    { position, scale }: Camera
) => guidePlace(pointer, orientation === 'horizontal' ? position.y : position.x, scale);

const placeDrag = (drag: Drag, camera: Camera, rulerSize: number): PlacedDrag => {
    const { at, offset } = placeOnCamera(drag, camera);

    return {
        orientation: drag.orientation,
        marks: drag.marks,
        guideId: drag.guideId,
        at,
        offset,
        removing: removesGuide(at, rulerSize, drag.length),
        label: guideLabelPlace(drag.orientation, at, drag.across, drag.bounds, rulerSize)
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
    const documentId = useCurrentDocumentId();
    const locked = useDocumentLocked();
    const controls = useControls();
    const gestureInProgress = useGestureInProgress();
    const drag = useSyncExternalStore(subscribe, takeCurrent);
    const rulerSize = controls.rulers.visible ? RULER_SIZE_PX : 0;
    const latest = useRef({
        camera,
        guides,
        rulerSize,
        locked,
        guidesShown: controls.guides.visible
    });
    const owner = useRef(false);

    latest.current = { camera, guides, rulerSize, locked, guidesShown: controls.guides.visible };

    useEffect(
        () => () => {
            if (owner.current) {
                stopCurrent?.();
            }
        },
        [documentId]
    );

    const drop = (released: Drag) => {
        const { camera: view, guides: present, rulerSize: edge, guidesShown } = latest.current;
        const { orientation, guideId } = released;
        const { offset, at } = placeOnCamera(released, view);

        // Another copy removed, hid, locked or reoriented it meanwhile.
        if (
            latest.current.locked ||
            (guideId !== null &&
                (!guidesShown ||
                    !present[guideId]?.visible ||
                    present[guideId].locked ||
                    present[guideId].orientation !== orientation))
        ) {
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
            actions.selectGuide(guideId);

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
            locked ||
            !surface ||
            stopCurrent ||
            gestureInProgress ||
            controls.contextMenu.visible
        ) {
            return;
        }

        const { pointerId } = event;
        const bounds = { width: surface.clientWidth, height: surface.clientHeight };
        const along = (input: { clientX: number; clientY: number }) => {
            const point = clientToSurface(input, surface);

            return (
                point &&
                (orientation === 'horizontal'
                    ? { pointer: point.y, across: point.x }
                    : { pointer: point.x, across: point.y })
            );
        };
        const start = along(event);

        if (start === null) {
            return;
        }

        event.stopPropagation();

        const length = orientation === 'horizontal' ? bounds.height : bounds.width;
        let movedBeyondClick = false;
        let outlines = readGuideOutlines(surface);
        let dirty = false;
        const observer = new MutationObserver(() => {
            dirty = true;
        });
        surface.querySelectorAll('#shapes, #screen-views, #frames').forEach((node) => {
            observer.observe(node, {
                subtree: true,
                attributes: true,
                childList: true,
                characterData: true
            });
            // Camera placement lives above the artwork, outside these subtrees.
            for (
                let parent: Element | null = node.parentElement;
                parent && parent !== surface;
                parent = parent.parentElement
            ) {
                observer.observe(parent, { attributes: true, attributeFilter: ['transform'] });
            }
        });
        const marksAt = (pointer: number) => {
            if (dirty) {
                outlines = readGuideOutlines(surface);
                dirty = false;
            }
            const { at } = placeOnCamera({ orientation, pointer }, latest.current.camera);

            return guideIntersections(outlines, orientation, at).filter(
                (point) =>
                    point.x >= 0 &&
                    point.y >= 0 &&
                    point.x <= bounds.width &&
                    point.y <= bounds.height
            );
        };

        const onPointer = (input: PointerEvent) => {
            if (input.pointerId !== pointerId || !current) {
                return;
            }

            input.stopPropagation();

            const { pointer, across } = along(input) ?? current;
            const moved = { ...current, pointer, across, marks: marksAt(pointer) };
            movedBeyondClick ||= beyondClickSlip(
                { x: start.pointer, y: 0 },
                { x: moved.pointer, y: 0 },
                1
            );

            if (input.type === 'pointermove') {
                setCurrent(moved);

                return;
            }

            stopCurrent?.();

            if (input.type !== 'pointerup') {
                return;
            }
            if (guideId !== null && !movedBeyondClick) {
                actions.selectGuide(guideId);

                return;
            }
            drop(moved);
        };

        const onKey = (input: KeyboardEvent) => {
            input.stopPropagation();

            if (input.key === 'Escape') {
                stopCurrent?.();
            }
        };

        const onBlur = () => stopCurrent?.();

        stopCurrent = () => {
            observer.disconnect();
            DRAG_EVENTS.forEach((type) => window.removeEventListener(type, onPointer, true));
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('blur', onBlur);
            tryReleasePointerCapture(surface, pointerId);
            stopCurrent = null;
            owner.current = false;
            setCurrent(null);
            actions.setGuideDragActive(false);
        };

        DRAG_EVENTS.forEach((type) => window.addEventListener(type, onPointer, true));
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('blur', onBlur);
        trySetPointerCapture(surface, pointerId);
        owner.current = true;
        actions.setGuideDragActive(true);
        setCurrent({
            orientation,
            guideId,
            ...start,
            length,
            bounds,
            marks: marksAt(start.pointer)
        });
    };

    return { drag: drag && placeDrag(drag, camera, rulerSize), begin };
}
