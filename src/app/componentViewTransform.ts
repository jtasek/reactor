import type { Box, Point, ShapeInput } from './types';
import type { ComponentViewTransform } from 'src/events/types';
import { boxCenter, getShapeBounds, rotatePoint } from './utils';
import { translateShape } from './geometry';

/** One rigid placement of a master, pinned for the duration of focused editing. */
export function componentViewPoint(point: Point, transform: ComponentViewTransform): Point {
    const { origin, position, size, rotation } = transform;
    const turned = rotatePoint(
        point,
        { x: origin.x + size.width / 2, y: origin.y + size.height / 2 },
        rotation
    );

    return { x: turned.x + position.x - origin.x, y: turned.y + position.y - origin.y };
}

export function componentSourcePoint(point: Point, transform: ComponentViewTransform): Point {
    const { origin, position, size, rotation } = transform;

    return rotatePoint(
        { x: point.x + origin.x - position.x, y: point.y + origin.y - position.y },
        { x: origin.x + size.width / 2, y: origin.y + size.height / 2 },
        -rotation
    );
}

/** Screen-axis movement becomes a master-axis delta; translation does not affect it. */
export function componentSourceDelta(delta: Point, transform?: ComponentViewTransform): Point {
    const rotation = (((transform?.rotation ?? 0) % 360) + 360) % 360;

    // Exact quarter turns keep an unchanged axis at zero, preserving its bindings.
    switch (rotation) {
        case 0:
            return delta;
        case 90:
            return { x: delta.y, y: -delta.x };
        case 180:
            return { x: -delta.x, y: -delta.y };
        case 270:
            return { x: -delta.y, y: delta.x };
        default:
            return rotatePoint(delta, { x: 0, y: 0 }, -rotation);
    }
}

/**
 * An arrow-key step in master axes. At uneven angles the turned step is rounded to whole
 * pixels, so repeated nudges do not leave fractional coordinates in shared geometry.
 */
export function componentSourceNudge(delta: Point, transform?: ComponentViewTransform): Point {
    const moved = componentSourceDelta(delta, transform);

    if ((transform?.rotation ?? 0) % 90 === 0) {
        return moved;
    }

    return { x: Math.round(moved.x) || 0, y: Math.round(moved.y) || 0 };
}

export function componentViewBox(box: Box, transform: ComponentViewTransform): Box {
    const center = boxCenter(box);
    const placed = componentViewPoint(center, transform);
    const offset = { x: placed.x - center.x, y: placed.y - center.y };

    return {
        ...box,
        topLeft: { x: box.topLeft.x + offset.x, y: box.topLeft.y + offset.y },
        bottomRight: { x: box.bottomRight.x + offset.x, y: box.bottomRight.y + offset.y }
    };
}

/** Move the primitive's center and compose its own rotation, preserving its geometry. */
export function transformComponentShape(
    shape: ShapeInput,
    transform: ComponentViewTransform,
    toSource = false
) {
    const center = boxCenter(getShapeBounds(shape));
    const target = toSource
        ? componentSourcePoint(center, transform)
        : componentViewPoint(center, transform);
    translateShape(shape, { x: target.x - center.x, y: target.y - center.y });

    if (transform.rotation) {
        shape.rotation = (shape.rotation ?? 0) + (toSource ? -1 : 1) * transform.rotation;
    }
}
