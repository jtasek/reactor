import { derived } from 'overmind';
import { Application, Point, Size } from 'src/app/types';
import { Gesture, Pointer } from '../types';

export const center = derived<Pointer, Application, Point>(({ current, start }) => {
    return {
        x: start.x + (current.x - start.x) / 2,
        y: start.y + (current.y - start.y) / 2
    };
});

export const offset = derived<Pointer, Application, Point>(({ current, start }) => {
    return {
        x: current.x - start.x,
        y: current.y - start.y
    };
});

export const size = derived<Pointer, Application, Size>(({ current, start }) => {
    return {
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y)
    };
});

export const bottomRight = derived<Pointer, Application, Point>(({ current, start }) => {
    return {
        x: start.x > current.x ? start.x : current.x,
        y: start.y > current.y ? start.y : current.y
    };
});

export const topLeft = derived<Pointer, Application, Point>((pointer) => {
    const { current, start } = pointer;

    return {
        x: start.x > current.x ? current.x : start.x,
        y: start.y > current.y ? current.y : start.y
    };
});

/** True while a pointer drags; a pinch only moves the camera, so it is not a drag. */
export const dragging = derived<Pointer, Application, boolean>(
    ({ gesture }) => gesture.kind !== 'idle' && gesture.kind !== 'pinching'
);

/** True while a marquee selection is being dragged from empty canvas. */
export const background = derived<Pointer, Application, boolean>(
    ({ gesture }) => gesture.kind === 'marquee'
);

/**
 * Whether a gesture keeps the measured bounds of the shapes it edits itself, as
 * it moves, scales or turns them. Such shapes are not measured again until the
 * gesture ends: measuring makes the browser lay out, once per shape per frame.
 * A new kind of gesture has to say which it is.
 */
export const KEEPS_SHAPE_BOUNDS: Record<Gesture['kind'], boolean> = {
    idle: false,
    editingFrame: true,
    pinching: false,
    // The shape drawn is new, and a marquee edits none.
    drawing: false,
    marquee: false,
    moving: true,
    resizing: true,
    rotating: true,
    // Rounding the corners leaves the box they are drawn in as it is.
    rounding: true,
    // Margin and padding move shapes in a stack by its layout, not by their bounds.
    spacing: true,
    resizingGroup: true,
    rotatingGroup: true,
    resizingComponent: true,
    rotatingComponent: true
};

/** Whether the gesture keeps the bounds of the shapes it edits: see `KEEPS_SHAPE_BOUNDS`. */
export const keepsShapeBounds = derived<Pointer, Application, boolean>(
    ({ gesture }) => KEEPS_SHAPE_BOUNDS[gesture.kind]
);
