import { Box, Circle, Line, Point, Shape, Vector } from './types';

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

export function getBoundingBoxForRectangle(rectangle: Box): Box {
    return rectangle;
}

export function getBoundingBoxForCircle(circle: Circle): Box {
    return {
        topLeft: { x: circle.position.x - circle.radius, y: circle.position.y - circle.radius },
        bottomRight: { x: circle.position.x + circle.radius, y: circle.position.y + circle.radius }
    };
}

export function getBoundingBoxForEllipse(ellipse: Ellipse): Box {
    return {
        topLeft: {
            x: ellipse.position.x - ellipse.radius.x,
            y: ellipse.position.y - ellipse.radius.y
        },
        bottomRight: {
            x: ellipse.position.x + ellipse.radius.x,
            y: ellipse.position.y + ellipse.radius.y
        }
    };
}

export function getBoundingBoxForLine(line: Line): Box {
    return { topLeft: line.start, bottomRight: line.end };
}

export function getBoundingBox(shape: Partial<Shape>): Box | undefined {
    if (!shape) {
        return undefined;
    }

    if (shape.type === 'line') {
        return getBoundingBoxForLine(shape as Line);
    }

    if (shape.type === 'circle') {
        return getBoundingBoxForCircle(shape as Circle);
    }

    if (shape.type === 'ellipse') {
        return getBoundingBoxForEllipse(shape as Ellipse);
    }

    // image, rect, text
    return getBoundingBoxForRectangle(shape as Box);
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

export interface Ellipse {
    position: Point;
    radius: Point;
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
