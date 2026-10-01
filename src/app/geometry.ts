import type { Box, Point, ResizeHandlerType, Shape } from './types';
import {
    DEFAULT_TEXT_FONT_SIZE,
    assertNever,
    boxCenter,
    getDistance,
    getShapeBounds,
    mapPointBetweenBoxes,
    overlaps,
    resizeBox,
    rotatePoint
} from './utils';

/** Half the stroke width shapes are drawn with (`.shape` in src/tools/styles.css). */
const STROKE_HALF_WIDTH = 1;

/** Extra reach of a press, in screen pixels, so thin strokes stay easy to hit. */
const HIT_SLOP_PX = 4;

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
 * Moves a box resized in a rotated shape's unrotated frame so the shape is drawn
 * where it was: the shape rotates about its box's center, which moves as the box
 * changes size, so the box is shifted by how far the old and new pivots would
 * carry it apart.
 */
function keepDrawnPlace(box: Box, oldCenter: Point, rotation: number): Box {
    const center = boxCenter(box);
    const drawn = rotatePoint(center, oldCenter, rotation);
    const shift = { x: drawn.x - center.x, y: drawn.y - center.y };

    return {
        topLeft: add(box.topLeft, shift),
        bottomRight: add(box.bottomRight, shift),
        width: box.width,
        height: box.height
    };
}

/**
 * Resizes a shape in place so the dragged handle follows `pointer`, from the shape
 * as it was when the drag began (`original`), so the result depends only on where
 * the pointer is. The shape is drawn rotated about its box center while its
 * geometry stays axis-aligned: the pointer is mapped into that unrotated frame,
 * and the resized box is moved so the opposite handle stays where it was drawn.
 */
export function resizeShapeFromHandle(
    shape: Shape,
    handlerType: ResizeHandlerType,
    pointer: Point,
    original: Shape = shape
): void {
    const oldBox = getShapeBounds(original);
    const center = boxCenter(oldBox);
    const rotation = original.rotation ?? 0;
    const local = rotation ? rotatePoint(pointer, center, -rotation) : pointer;
    const ratio = oldBox.height > 0 ? oldBox.width / oldBox.height : 1;
    // Images keep their aspect ratio, so they never letterbox inside their box,
    // text scales with its font size, and circles stay round.
    const resized =
        original.type === 'image' || original.type === 'text' || original.type === 'circle'
            ? resizeAspectBox(oldBox, handlerType, local, original.type === 'circle' ? 1 : ratio)
            : resizeBox(oldBox, handlerType, local);
    const box = rotation ? keepDrawnPlace(resized, center, rotation) : resized;
    const scaleX = oldBox.width > 0 ? box.width / oldBox.width : 1;
    const scaleY = oldBox.height > 0 ? box.height / oldBox.height : 1;

    switch (shape.type) {
        case 'image':
        case 'rectangle':
            shape.position = { x: box.topLeft.x, y: box.topLeft.y };
            shape.size = { width: box.width, height: box.height };
            break;

        case 'circle':
            shape.position = boxCenter(box);
            shape.radius = box.width / 2;
            break;

        case 'ellipse':
            shape.position = boxCenter(box);
            shape.radius = { x: box.width / 2, y: box.height / 2 };
            break;

        case 'line':
            if (original.type === 'line') {
                shape.start = mapPointBetweenBoxes(original.start, oldBox, box);
                shape.end = mapPointBetweenBoxes(original.end, oldBox, box);
            }
            break;

        case 'pen':
            if (original.type === 'pen') {
                shape.points = original.points.map((point) =>
                    mapPointBetweenBoxes(point, oldBox, box)
                );
            }
            break;

        case 'text':
            if (original.type === 'text') {
                shape.fontSize = Math.max(
                    1,
                    (original.fontSize ?? DEFAULT_TEXT_FONT_SIZE) * scaleY
                );
                // Text is placed at its baseline, below the top of its box.
                shape.position = {
                    x: box.topLeft.x + (original.position.x - oldBox.topLeft.x) * scaleX,
                    y: box.topLeft.y + (original.position.y - oldBox.topLeft.y) * scaleY
                };
            }
            break;

        default:
            assertNever(shape);
    }

    // The pivot follows the new box at once, rather than after the next measurement.
    shape.bounds = box;
}

/** How far from a shape's drawn geometry a press still hits it, in world units. */
export function hitTolerance(cameraScale: number): number {
    return STROKE_HALF_WIDTH + HIT_SLOP_PX / cameraScale;
}

function distanceToBox(point: Point, box: Box): number {
    const dx = Math.max(box.topLeft.x - point.x, 0, point.x - box.bottomRight.x);
    const dy = Math.max(box.topLeft.y - point.y, 0, point.y - box.bottomRight.y);

    return Math.hypot(dx, dy);
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const t =
        lengthSquared === 0
            ? 0
            : Math.max(
                  0,
                  Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
              );

    return getDistance(point, { x: start.x + t * dx, y: start.y + t * dy });
}

function distanceToPolyline(point: Point, points: Point[]): number {
    if (points.length === 1) {
        return getDistance(point, points[0]);
    }

    let distance = Infinity;

    for (let index = 1; index < points.length; index++) {
        distance = Math.min(distance, distanceToSegment(point, points[index - 1], points[index]));
    }

    return distance;
}

/**
 * Whether `point` hits `shape` where it is drawn: within `tolerance` of its
 * outline, or anywhere inside a closed shape (rectangle, image, text, circle,
 * ellipse). Lines and pens are open, so only their stroke hits. Shapes are drawn
 * rotated about their box center, so the point is tested in the unrotated frame.
 */
export function hitTestShape(shape: Shape, point: Point, tolerance: number): boolean {
    const bounds = getShapeBounds(shape);
    const local = shape.rotation ? rotatePoint(point, boxCenter(bounds), -shape.rotation) : point;

    switch (shape.type) {
        case 'rectangle':
        case 'image':
        case 'text':
            return distanceToBox(local, bounds) <= tolerance;
        case 'circle':
            return getDistance(local, shape.position) <= shape.radius + tolerance;
        case 'ellipse': {
            // Inflating the radii approximates the band around the outline.
            const dx = (local.x - shape.position.x) / (shape.radius.x + tolerance);
            const dy = (local.y - shape.position.y) / (shape.radius.y + tolerance);

            return dx * dx + dy * dy <= 1;
        }
        case 'line':
            return distanceToSegment(local, shape.start, shape.end) <= tolerance;
        case 'pen':
            return distanceToPolyline(local, shape.points) <= tolerance;
        default:
            return assertNever(shape);
    }
}

function boxCorners(box: Pick<Box, 'topLeft' | 'bottomRight'>): Point[] {
    return [
        box.topLeft,
        { x: box.bottomRight.x, y: box.topLeft.y },
        box.bottomRight,
        { x: box.topLeft.x, y: box.bottomRight.y }
    ];
}

/** Whether the projections of two point sets onto `axis` do not overlap. */
function separatedAlong(axis: Point, a: Point[], b: Point[]): boolean {
    const project = (points: Point[]) => points.map((point) => point.x * axis.x + point.y * axis.y);
    const pa = project(a);
    const pb = project(b);

    return Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa);
}

/**
 * Whether a shape's drawn bounding box (rotated with the shape) intersects an
 * axis-aligned `area`, such as a marquee. Rotated boxes are compared with the
 * separating axis test.
 */
export function shapeIntersectsBox(
    shape: Shape,
    area: Pick<Box, 'topLeft' | 'bottomRight'>
): boolean {
    const bounds = getShapeBounds(shape);
    const { rotation } = shape;

    if (!rotation) {
        return overlaps(area, bounds);
    }

    const center = boxCenter(bounds);
    const corners = boxCorners(bounds).map((corner) => rotatePoint(corner, center, rotation));
    const radians = (rotation * Math.PI) / 180;
    const axes = [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: Math.cos(radians), y: Math.sin(radians) },
        { x: -Math.sin(radians), y: Math.cos(radians) }
    ];

    return !axes.some((axis) => separatedAlong(axis, corners, boxCorners(area)));
}

/** The direction each resize handle points from the box center, in degrees clockwise from +x. */
const HANDLE_DIRECTIONS: Record<ResizeHandlerType, number> = {
    middleRight: 0,
    bottomRight: 45,
    middleBottom: 90,
    bottomLeft: 135,
    middleLeft: 180,
    topLeft: 225,
    middleTop: 270,
    topRight: 315
};

const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];

/** The resize cursor for a handle of a shape drawn rotated by `rotation` degrees. */
export function resizeCursor(handlerType: ResizeHandlerType, rotation = 0): string {
    const direction = (((HANDLE_DIRECTIONS[handlerType] + rotation) % 180) + 180) % 180;

    return RESIZE_CURSORS[Math.round(direction / 45) % RESIZE_CURSORS.length];
}
