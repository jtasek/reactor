import type { Gesture } from './types';

/**
 * Whether a gesture keeps the measured bounds of the shapes it edits itself, as
 * it moves, scales or turns them. Such shapes are not measured again until the
 * gesture ends: measuring makes the browser lay out, once per shape per frame.
 * A new kind of gesture has to say which it is.
 */
export const KEEPS_SHAPE_BOUNDS: Record<Gesture['kind'], boolean> = {
    idle: false,
    pinching: false,
    // The shape drawn is new, and a marquee edits none.
    drawing: false,
    marquee: false,
    moving: true,
    resizing: true,
    rotating: true,
    resizingGroup: true,
    rotatingGroup: true
};
