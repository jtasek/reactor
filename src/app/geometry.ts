import type { Box, Point, ResizeHandlerType, Shape } from './types';
import {
    DEFAULT_TEXT_FONT_SIZE,
    assertNever,
    boxCenter,
    getShapeBounds,
    mapPointBetweenBoxes,
    resizeBox,
    rotatePoint
} from './utils';

const add = (point: Point, delta: Point): Point => ({ x: point.x + delta.x, y: point.y + delta.y });

/** Moves a shape's geometry, and its measured bounds, by `delta` in place. */
export function translateShape(shape: Shape, delta: Point): void {
    switch (shape.type) {
        case 'line':
            shape.start = add(shape.start, delta);
            shape.end = add(shape.end, delta);
            break;
        case 'pen':
            shape.points = shape.points.map((point) => add(point, delta));
            break;
        case 'rectangle':
        case 'image':
        case 'circle':
        case 'ellipse':
        case 'text':
            shape.position = add(shape.position, delta);
            break;
        default:
            assertNever(shape);
    }

    // Shift the measured bounds too so the selection box and handles follow the
    // shape immediately, without waiting for the next getBBox measurement.
    if (shape.bounds) {
        shape.bounds = {
            topLeft: add(shape.bounds.topLeft, delta),
            bottomRight: add(shape.bounds.bottomRight, delta),
            width: shape.bounds.width,
            height: shape.bounds.height
        };
    }
}

/**
 * Resizes a box from a handle drag while locking it to `ratio` (width / height).
 * Corner handles keep the dominant axis and anchor the opposite corner; middle
 * handles drive their own axis, derive the other from the ratio, and stay
 * centred on the perpendicular axis.
 */
function resizeAspectBox(
    oldBox: Box,
    handlerType: ResizeHandlerType,
    pointer: Point,
    ratio: number,
    min = 1
): Box {
    const free = resizeBox(oldBox, handlerType, pointer, min);

    const left = oldBox.topLeft.x;
    const top = oldBox.topLeft.y;
    const right = oldBox.bottomRight.x;
    const bottom = oldBox.bottomRight.y;
    const centerX = left + oldBox.width / 2;
    const centerY = top + oldBox.height / 2;

    const isHorizontalMiddle = handlerType === 'middleLeft' || handlerType === 'middleRight';
    const isVerticalMiddle = handlerType === 'middleTop' || handlerType === 'middleBottom';

    let width = free.width;
    let height = free.height;

    if (isHorizontalMiddle) {
        height = width / ratio;
    } else if (isVerticalMiddle) {
        width = height * ratio;
    } else if (width / ratio >= height) {
        height = width / ratio;
    } else {
        width = height * ratio;
    }

    const movesLeft =
        handlerType === 'topLeft' || handlerType === 'middleLeft' || handlerType === 'bottomLeft';
    const movesRight =
        handlerType === 'topRight' ||
        handlerType === 'middleRight' ||
        handlerType === 'bottomRight';
    const movesTop =
        handlerType === 'topLeft' || handlerType === 'middleTop' || handlerType === 'topRight';
    const movesBottom =
        handlerType === 'bottomLeft' ||
        handlerType === 'middleBottom' ||
        handlerType === 'bottomRight';

    let x = centerX - width / 2;

    if (movesLeft) {
        x = right - width;
    } else if (movesRight) {
        x = left;
    }

    let y = centerY - height / 2;

    if (movesTop) {
        y = bottom - height;
    } else if (movesBottom) {
        y = top;
    }

    return {
        topLeft: { x, y },
        bottomRight: { x: x + width, y: y + height },
        width,
        height
    };
}

/**
 * Resizes a shape in place so the dragged handle follows `pointer`. The shape is
 * rendered rotated around its box center while its geometry stays axis-aligned,
 * so the pointer is first mapped back into that unrotated frame.
 */
export function resizeShapeFromHandle(
    shape: Shape,
    handlerType: ResizeHandlerType,
    pointer: Point
): void {
    const oldBox = getShapeBounds(shape);
    const local = shape.rotation
        ? rotatePoint(pointer, boxCenter(oldBox), -shape.rotation)
        : pointer;
    const newBox = resizeBox(oldBox, handlerType, local);

    switch (shape.type) {
        case 'image': {
            // Lock to the image's aspect ratio so it never letterboxes inside its
            // box (which would leave the selection border outside the picture).
            const ratio = oldBox.height > 0 ? oldBox.width / oldBox.height : 1;
            const box = resizeAspectBox(oldBox, handlerType, local, ratio);

            shape.position = { x: box.topLeft.x, y: box.topLeft.y };
            shape.size = { width: box.width, height: box.height };
            break;
        }

        case 'rectangle':
            shape.position = { x: newBox.topLeft.x, y: newBox.topLeft.y };
            shape.size = { width: newBox.width, height: newBox.height };
            break;

        case 'circle': {
            const box = resizeAspectBox(oldBox, handlerType, local, 1);

            shape.position = boxCenter(box);
            shape.radius = box.width / 2;
            break;
        }

        case 'ellipse':
            shape.position = boxCenter(newBox);
            shape.radius = { x: newBox.width / 2, y: newBox.height / 2 };
            break;

        case 'line':
            shape.start = mapPointBetweenBoxes(shape.start, oldBox, newBox);
            shape.end = mapPointBetweenBoxes(shape.end, oldBox, newBox);
            break;

        case 'pen':
            shape.points = shape.points.map((point) => mapPointBetweenBoxes(point, oldBox, newBox));
            break;

        case 'text': {
            const ratio = oldBox.height > 0 ? newBox.height / oldBox.height : 1;

            shape.fontSize = Math.max(1, (shape.fontSize ?? DEFAULT_TEXT_FONT_SIZE) * ratio);
            // Keep the top edge following the handle (text anchors at its baseline).
            shape.position = {
                x: newBox.topLeft.x,
                y: shape.position.y + (newBox.topLeft.y - oldBox.topLeft.y)
            };
            break;
        }

        default:
            assertNever(shape);
    }
}
