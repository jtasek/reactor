import { Box, Circle, Ellipse, Line, Point, Shape } from './types';

function isPointInBox(point: Point, box: Box): boolean {
  return (
    point.x >= box.topLeft.x &&
    point.x <= box.bottomRight.x &&
    point.y >= box.topLeft.y &&
    point.y <= box.bottomRight.y
  );
}

function isCircleInBox(shape: Shape, box: Box): boolean {
  const { center, radius } = shape as Circle;
  const closestPoint = {
    x: Math.max(box.topLeft.x, Math.min(center.x, box.bottomRight.x)),
    y: Math.max(box.topLeft.y, Math.min(center.y, box.bottomRight.y))
  };
  const distance = Math.sqrt((center.x - closestPoint.x) ** 2 + (center.y - closestPoint.y) ** 2);

  return distance <= radius && isPointInBox(center, box);
}

function isEllipseInBox(shape: Shape, box: Box): boolean {
  const { center, radiusX, radiusY } = shape as Ellipse;
  const normalizedPoint = {
    x: (center.x - box.topLeft.x) / (box.bottomRight.x - box.topLeft.x),
    y: (center.y - box.topLeft.y) / (box.bottomRight.y - box.topLeft.y)
  };

  return (
    (normalizedPoint.x - 0.5) ** 2 / radiusX ** 2 + (normalizedPoint.y - 0.5) ** 2 / radiusY ** 2 <=
    0.25
  );
}

function isTextInBox(shape: Shape, box: Box): boolean {
  // Assume text is contained if its top-left corner is in the box
  const text = shape as unknown as Text;

  return isPointInBox(text.position, box);
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
