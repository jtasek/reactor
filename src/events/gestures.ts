import type { Point } from '../app/types';
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

/** How far a pressed pointer may slip, in screen pixels, and still click rather than drag. */
const CLICK_SLIP_PX = 3;

/** Whether the pointer went from `start` beyond a click's slip, at the camera's scale. */
export const beyondClickSlip = (start: Point, position: Point, cameraScale: number) =>
    Math.hypot(position.x - start.x, position.y - start.y) * cameraScale > CLICK_SLIP_PX;
