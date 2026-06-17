import {
    Box,
    Circle,
    Document,
    Ellipse,
    Line,
    Pen,
    Point,
    Rectangle,
    ResizeHandlerType,
    Shape,
    Text,
    Vector
} from './types';

export function stringifyPath(path: Point[]): string {
    return path.map((point: Point) => `${point.x}, ${point.y}`).join(' ');
}

export function getRandomNumber(max: number): number {
    return Math.floor(Math.random() * max);
}

export function debounce<A extends unknown[]>(
    fn: (...args: A) => void,
    delay: number
): (...args: A) => void {
    let timer: ReturnType<typeof setTimeout> | undefined;

    return (...args: A) => {
        if (timer !== undefined) {
            clearTimeout(timer);
        }

        timer = setTimeout(() => fn(...args), delay);
    };
}

export function getRandomColor(): string {
    return `rgb(${getRandomNumber(255)}, ${getRandomNumber(255)}, ${getRandomNumber(255)})`;
}

export function getDistance(p1: Point, p2: Point): number {
    return Math.hypot(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
}

export function getRectBoundingBox(rectangle: Rectangle): Box {
    const topLeft = rectangle.position;
    const bottomRight = {
        x: rectangle.position.x + rectangle.size.width,
        y: rectangle.position.y + rectangle.size.height
    };

    return {
        topLeft,
        bottomRight,
        width: rectangle.size.width,
        height: rectangle.size.height
    };
}

export function getCircleBoundingBox(circle: Circle): Box {
    const topLeft = {
        x: circle.position.x - circle.radius,
        y: circle.position.y - circle.radius
    };
    const bottomRight = {
        x: circle.position.x + circle.radius,
        y: circle.position.y + circle.radius
    };
    const diameter = circle.radius * 2;

    return {
        topLeft,
        bottomRight,
        width: diameter,
        height: diameter
    };
}

export function getEllipseBoundingBox(ellipse: Ellipse): Box {
    const topLeft = {
        x: ellipse.position.x - ellipse.radius.x,
        y: ellipse.position.y - ellipse.radius.y
    };
    const bottomRight = {
        x: ellipse.position.x + ellipse.radius.x,
        y: ellipse.position.y + ellipse.radius.y
    };
    const width = ellipse.radius.x * 2;
    const height = ellipse.radius.y * 2;

    return {
        topLeft,
        bottomRight,
        width,
        height
    };
}

export function getLineBoundingBox(line: Line): Box {
    const topLeft = {
        x: Math.min(line.start.x, line.end.x),
        y: Math.min(line.start.y, line.end.y)
    };
    const bottomRight = {
        x: Math.max(line.start.x, line.end.x),
        y: Math.max(line.start.y, line.end.y)
    };
    const width = Math.abs(line.end.x - line.start.x);
    const height = Math.abs(line.end.y - line.start.y);

    return { topLeft, bottomRight, height, width };
}

export function getPathBoundingBox({ points }: Pen) {
    if (points.length === 0) {
        return {
            topLeft: { x: 0, y: 0 },
            bottomRight: { x: 0, y: 0 },
            width: 0,
            height: 0
        };
    }

    const { minX, minY, maxX, maxY } = points.reduce(
        (acc, { x, y }) => ({
            minX: Math.min(acc.minX, x),
            minY: Math.min(acc.minY, y),
            maxX: Math.max(acc.maxX, x),
            maxY: Math.max(acc.maxY, y)
        }),
        {
            minX: points[0].x,
            minY: points[0].y,
            maxX: points[0].x,
            maxY: points[0].y
        }
    );

    const topLeft = { x: minX, y: minY };
    const bottomRight = { x: maxX, y: maxY };
    const width = maxX - minX;
    const height = maxY - minY;

    return {
        topLeft,
        bottomRight,
        width,
        height
    };
}

export const DEFAULT_TEXT_FONT_SIZE = 24; // matches .shape font-size: 1.5rem
const TEXT_CHAR_WIDTH_RATIO = 0.6;
const TEXT_ASCENT_RATIO = 0.8;

export function getTextBoundingBox(text: Text): Box {
    const value = (text as { value?: string }).value ?? text.text ?? '';
    const fontSize = text.fontSize ?? DEFAULT_TEXT_FONT_SIZE;

    const width = value.length * fontSize * TEXT_CHAR_WIDTH_RATIO;
    const height = fontSize;

    // SVG <text> anchors at the left baseline, so the glyphs sit above the y point.
    const topLeft = {
        x: text.position.x,
        y: text.position.y - fontSize * TEXT_ASCENT_RATIO
    };
    const bottomRight = {
        x: topLeft.x + width,
        y: topLeft.y + height
    };

    return {
        topLeft,
        bottomRight,
        width,
        height
    };
}

export function getBoundingBox(shape: Partial<Shape>): Box {
    if (shape.type === 'line') {
        return getLineBoundingBox(shape as Line);
    }

    if (shape.type === 'circle') {
        return getCircleBoundingBox(shape as Circle);
    }

    if (shape.type === 'ellipse') {
        return getEllipseBoundingBox(shape as Ellipse);
    }

    if (shape.type === 'pen') {
        return getPathBoundingBox(shape as Pen);
    }

    if (shape.type === 'text') {
        return getTextBoundingBox(shape as Text);
    }

    // image, rect
    return getRectBoundingBox(shape as Rectangle);
}

/**
 * Returns the exact bounds measured from the rendered SVG element when available
 * (see getBBox measurement in the Shape component), falling back to the analytic
 * box for shapes that have not been measured yet.
 */
export function getShapeBounds(shape: Partial<Shape>): Box {
    return shape.bounds ?? getBoundingBox(shape);
}

export function rectToBox(rect: { x: number; y: number; width: number; height: number }): Box {
    return {
        topLeft: { x: rect.x, y: rect.y },
        bottomRight: { x: rect.x + rect.width, y: rect.y + rect.height },
        width: rect.width,
        height: rect.height
    };
}

export function boxesEqual(a: Box, b: Box, epsilon = 0.5): boolean {
    return (
        Math.abs(a.topLeft.x - b.topLeft.x) < epsilon &&
        Math.abs(a.topLeft.y - b.topLeft.y) < epsilon &&
        Math.abs(a.width - b.width) < epsilon &&
        Math.abs(a.height - b.height) < epsilon
    );
}

type GeometryView = {
    type: string;
    position?: Point;
    size?: { width: number; height: number };
    radius?: number | Point;
    start?: Point;
    end?: Point;
    points?: Point[];
    value?: string;
    text?: string;
    fontSize?: number;
};

/**
 * A stable string describing only the geometry-relevant fields of a shape. Used
 * to decide when a shape must be re-measured, so toggling unrelated state such as
 * `selected` does not force an expensive getBBox reflow.
 */
export function shapeGeometryKey(shape: Shape): string {
    const g = shape as unknown as GeometryView;

    return JSON.stringify({
        type: g.type,
        position: g.position,
        size: g.size,
        radius: g.radius,
        start: g.start,
        end: g.end,
        points: g.points,
        value: g.value,
        text: g.text,
        fontSize: g.fontSize
    });
}

/**
 * Returns a new box after dragging a resize handle to `pointer`. The edges the
 * handle controls follow the pointer; the opposite edges stay fixed and the box
 * is clamped so it never collapses past `min`.
 */
export function resizeBox(box: Box, handlerType: ResizeHandlerType, pointer: Point, min = 1): Box {
    let left = box.topLeft.x;
    let top = box.topLeft.y;
    let right = box.bottomRight.x;
    let bottom = box.bottomRight.y;

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

    if (movesLeft) {
        left = Math.min(pointer.x, right - min);
    }
    if (movesRight) {
        right = Math.max(pointer.x, left + min);
    }
    if (movesTop) {
        top = Math.min(pointer.y, bottom - min);
    }
    if (movesBottom) {
        bottom = Math.max(pointer.y, top + min);
    }

    return {
        topLeft: { x: left, y: top },
        bottomRight: { x: right, y: bottom },
        width: right - left,
        height: bottom - top
    };
}

/** Maps a point from one box's local space into another box (proportional scale). */
export function mapPointBetweenBoxes(point: Point, from: Box, to: Box): Point {
    const fx = from.width > 0 ? (point.x - from.topLeft.x) / from.width : 0;
    const fy = from.height > 0 ? (point.y - from.topLeft.y) / from.height : 0;

    return {
        x: to.topLeft.x + fx * to.width,
        y: to.topLeft.y + fy * to.height
    };
}

export function isPointInBox(p: Point, shape: Partial<Shape>): boolean {
    const box = getShapeBounds(shape);

    if (!box) {
        return false;
    }

    const horizontalFit = box.topLeft!.x <= p.x && p.x <= box.bottomRight.x;
    const verticalFit = box.topLeft!.y <= p.y && p.y <= box.bottomRight.y;

    return horizontalFit && verticalFit;
}

export function isCircleInBox(center: Point, r: number, box: Box): boolean {
    // Step 1: Check if the center of the circle is inside the rectangle
    if (
        center.x < box.topLeft.x ||
        center.x > box.bottomRight.x ||
        center.y < box.topLeft.y ||
        center.y > box.bottomRight.y
    ) {
        return false;
    }

    // Step 2: Calculate the four points on the perimeter of the circle
    const top_point = { x: center.x, y: center.y - r };
    const bottom_point = { x: center.x, y: center.y + r };
    const left_point = { x: center.x - r, y: center.y };
    const right_point = { x: center.x + r, y: center.y };

    // Step 3: Check if all the points are inside the rectangle
    return (
        top_point.x >= box.topLeft.x &&
        top_point.x <= box.bottomRight.x &&
        top_point.y >= box.topLeft.y &&
        top_point.y <= box.bottomRight.y &&
        bottom_point.x >= box.topLeft.x &&
        bottom_point.x <= box.bottomRight.x &&
        bottom_point.y >= box.topLeft.y &&
        bottom_point.y <= box.bottomRight.y &&
        left_point.x >= box.topLeft.x &&
        left_point.y >= box.topLeft.y &&
        left_point.y <= box.bottomRight.y &&
        right_point.x <= box.bottomRight.x &&
        right_point.y >= box.topLeft.y &&
        right_point.y <= box.bottomRight.y
    );
}

export function isRectangleInBox(box1: Box, box2: Box): boolean {
    // Check if box1 is contained within box2
    return (
        box1.topLeft.x >= box2.topLeft.x &&
        box1.bottomRight.x <= box2.bottomRight.x &&
        box1.topLeft.y >= box2.topLeft.y &&
        box1.bottomRight.y <= box2.bottomRight.y
    );
}

export function isEllipseInBox(ellipse: Ellipse, box: Box): boolean {
    // Calculate the left, right, top, and bottom edges of the rectangle
    const leftEdge = box.topLeft.x;
    const rightEdge = box.bottomRight.x;
    const topEdge = box.topLeft.y;
    const bottomEdge = box.bottomRight.y;

    // Calculate the boundaries of the ellipse
    const leftEllipse = ellipse.position.x - ellipse.radius.x;
    const rightEllipse = ellipse.position.x + ellipse.radius.x;
    const topEllipse = ellipse.position.y - ellipse.radius.y;
    const bottomEllipse = ellipse.position.y + ellipse.radius.y;

    // Check if the boundaries of the ellipse are inside the rectangle
    return (
        leftEllipse >= leftEdge &&
        rightEllipse <= rightEdge &&
        topEllipse >= topEdge &&
        bottomEllipse <= bottomEdge
    );
}

export function overlaps(
    source?: Pick<Box, 'topLeft' | 'bottomRight'>,
    target?: Pick<Box, 'topLeft' | 'bottomRight'>
) {
    if (!source || !target) {
        return false;
    }

    if (source.bottomRight.x < target.topLeft.x || source.bottomRight.y < target.topLeft.y) {
        return false;
    }

    if (target.bottomRight.x < source.topLeft.x || target.bottomRight.y < source.topLeft.y) {
        return false;
    }

    return true;
}

export function getPropValue(prop: any): string | undefined {
    if (!prop) {
        return;
    }

    if (typeof prop === 'object') {
        if (prop instanceof Array) {
            return `${prop.length} item(s)`;
        }
        return '[object]';
    }

    if (typeof prop === 'function') {
        return '[function]';
    }

    return prop.toString();
}

export function vector(p1: Point, p2: Point): Vector {
    return {
        x: p2.x - p1.x,
        y: p2.y - p1.y
    };
}export function dot(u: Point, v: Point): number {
    return u.x * v.x + u.y * v.y;
}

/**
 * A shape is immutable when it is locked itself, when the document is locked, or
 * when it belongs to any locked group or layer. Used to block moves, resizes,
 * rotations, deletions and selection of locked shapes.
 */
export function isShapeLocked(document: Document | undefined, shapeId: string): boolean {
    if (!document) {
        return false;
    }

    const shape = document.shapes?.[shapeId];

    if (!shape) {
        return false;
    }

    if (document.locked || shape.locked) {
        return true;
    }

    const inLockedGroup = document.groupsIds?.some((id) => {
        const group = document.groups?.[id];
        return Boolean(group?.locked && group.shapesIds?.includes(shapeId));
    });

    if (inLockedGroup) {
        return true;
    }

    return Boolean(
        document.layersIds?.some((id) => {
            const layer = document.layers?.[id];
            return Boolean(layer?.locked && layer.shapesIds?.includes(shapeId));
        })
    );
}

/** Geometric center of a box. */
export function boxCenter(box: Box): Point {
    return {
        x: box.topLeft.x + box.width / 2,
        y: box.topLeft.y + box.height / 2
    };
}

/** Rotates `point` around `center` by `angle` degrees (clockwise in SVG's y-down space). */
export function rotatePoint(point: Point, center: Point, angle: number): Point {
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos
    };
}

/** Angle in degrees of the vector from `center` to `point`, measured from the +x axis. */
export function angleBetween(center: Point, point: Point): number {
    return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}
