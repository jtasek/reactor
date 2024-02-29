import { Box, Circle, Ellipse, Line, Point, Shape } from './types';

function isPointInBox(point: Point, box: Box): boolean {
    return (
        point.x >= box.topLeft.x &&
        point.x <= box.bottomRight.x &&
        point.y >= box.topLeft.y &&
        point.y <= box.bottomRight.y
    );
}

function isPathInBox(path: Point[], box: Box): boolean {
    const top = path.reduce((result, point) => (point.y < result ? point.y : result), 0);
    const left = path.reduce((result, point) => (point.x < result ? point.x : result), 0);
    const bottom = path.reduce((result, point) => (point.y > result ? point.y : result), 0);
    const right = path.reduce((result, point) => (point.x > result ? point.x : result), 0);

    return isPointInBox({ x: left, y: top }, box) && isPointInBox({ x: right, y: bottom }, box);
}

function isCircleInBox(shape: Shape, box: Box): boolean {
    const { position, radius } = shape as Circle;
    const closestPoint = {
        x: Math.max(box.topLeft.x, Math.min(position.x, box.bottomRight.x)),
        y: Math.max(box.topLeft.y, Math.min(position.y, box.bottomRight.y))
    };
    const distance = Math.sqrt(
        (position.x - closestPoint.x) ** 2 + (position.y - closestPoint.y) ** 2
    );

    return distance <= radius && isPointInBox(position, box);
}

function isEllipseInBox(shape: Shape, box: Box): boolean {
    const { position, radius } = shape as Ellipse;
    const normalizedPoint = {
        x: (position.x - box.topLeft.x) / (box.bottomRight.x - box.topLeft.x),
        y: (position.y - box.topLeft.y) / (box.bottomRight.y - box.topLeft.y)
    };

    return (
        (normalizedPoint.x - 0.5) ** 2 / radius.x ** 2 +
            (normalizedPoint.y - 0.5) ** 2 / radius.y ** 2 <=
        0.25
    );
}

function isTextInBox(shape: Shape, box: Box): boolean {
    // Assume text is contained if its top-left corner is in the box
    const text = shape as unknown as Text;

    return isRectangleInBox(text.position, box);
}

function isRectangleInBox(shape: Shape, box: Box): boolean {
    const rect = shape as unknown as Box;
    // Check if all four corners of the rectangle are inside the box
    return (
        isPointInBox(rect.topLeft, box) &&
        isPointInBox(rect.bottomRight, box) &&
        isPointInBox({ x: rect.topLeft.x, y: rect.bottomRight.y }, box) &&
        isPointInBox({ x: rect.bottomRight.x, y: rect.topLeft.y }, box)
    );
}

function isLineInBox(shape: Shape, box: Box): boolean {
    const line = shape as Line;
    // Check if both start and end points of the line are inside the box
    return isPointInBox(line.start, box) && isPointInBox(line.end, box);
}

type ShapeType = 'circle' | 'ellipse' | 'text' | 'rectangle' | 'line';
type ShapeStrategy = (shape: Shape, box: Box) => boolean;

export const shapeStrategies: Record<ShapeType, ShapeStrategy> = {
    circle: isCircleInBox,
    ellipse: isEllipseInBox,
    rectangle: isRectangleInBox,
    text: isTextInBox,
    line: isLineInBox
};
