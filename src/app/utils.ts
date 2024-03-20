import { Box, Circle, Ellipse, Line, Pen, Point, Rectangle, Shape, Vector } from './types';

export function stringifyPath(path: Point[]): string {
    return path.map((point: Point) => `${point.x}, ${point.y}`).join(' ');
}

export function getRandomNumber(max: number): number {
    return Math.floor(Math.random() * max);
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

export function getBoundingBox(shape: Partial<Shape>): Box | undefined {
    if (!shape) {
        return undefined;
    }

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

    // image, rect, text
    return getRectBoundingBox(shape as Rectangle);
}

export function isPointInBox(p: Point, shape: Partial<Shape>): boolean {
    const box = getBoundingBox(shape);

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

export function overlaps(source?: Box, target?: Box) {
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

export function getPropValue(prop: any): unknown {
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
}

export function dot(u: Point, v: Point): number {
    return u.x * v.x + u.y * v.y;
}
