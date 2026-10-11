import type { Document, Point, ResizeHandlerType } from './types';
import type { ShapesSnapshot } from 'src/events/types';
import type { GroupFrame } from './membership';
import { aspectRatio, keepDrawnPlace, placeShapeFrom, resizeAspectBox } from './geometry';
import { angleBetween, boxCenter, getShapeBounds, rotatePoint } from './utils';

/** Apply one rotation to a container's members from their gesture-start geometry. */
export function rotateContainerShapes(
    document: Document,
    position: Point,
    shapes: ShapesSnapshot,
    frame: GroupFrame
) {
    const center = boxCenter(frame.box);
    // The rotate handle sits directly above the box, so straight up is 0°.
    const rotation = angleBetween(center, position) + 90;
    const turn = rotation - frame.rotation;

    for (const [id, original] of Object.entries(shapes)) {
        const shape = document.shapes[id];

        if (!shape) {
            continue;
        }

        const from = boxCenter(getShapeBounds(original));
        const to = rotatePoint(from, center, turn);

        placeShapeFrom(shape, original, from, 1, { x: to.x - from.x, y: to.y - from.y });
        shape.rotation = (original.rotation ?? 0) + turn;
    }

    return rotation;
}

/** Scale every member proportionally, keeping the opposite edge in place. */
export function resizeContainerShapes(
    document: Document,
    handle: ResizeHandlerType,
    position: Point,
    shapes: ShapesSnapshot,
    frame: GroupFrame
) {
    const { box, rotation } = frame;
    const center = boxCenter(box);
    const local = rotation ? rotatePoint(position, center, -rotation) : position;
    const resized = resizeAspectBox(box, handle, local, aspectRatio(box));
    const placed = rotation ? keepDrawnPlace(resized, center, rotation) : resized;
    const factor = box.width > 0 ? placed.width / box.width : placed.height / box.height;
    const placedCenter = boxCenter(placed);

    for (const [id, original] of Object.entries(shapes)) {
        const shape = document.shapes[id];

        if (!shape) {
            continue;
        }

        const from = boxCenter(getShapeBounds(original));
        const inBox = rotation ? rotatePoint(from, center, -rotation) : from;
        const scaled = {
            x: placed.topLeft.x + (inBox.x - box.topLeft.x) * factor,
            y: placed.topLeft.y + (inBox.y - box.topLeft.y) * factor
        };
        const to = rotation ? rotatePoint(scaled, placedCenter, rotation) : scaled;

        placeShapeFrom(shape, original, from, factor, { x: to.x - from.x, y: to.y - from.y });
    }
}
