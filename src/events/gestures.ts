import type { Point } from '../app/types';

/** How far a pressed pointer may slip, in screen pixels, and still click rather than drag. */
const CLICK_SLIP_PX = 3;

/** Whether the pointer went from `start` beyond a click's slip, at the camera's scale. */
export const beyondClickSlip = (start: Point, position: Point, cameraScale: number) =>
    Math.hypot(position.x - start.x, position.y - start.y) * cameraScale > CLICK_SLIP_PX;
