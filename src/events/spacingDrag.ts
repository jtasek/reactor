import { type Side, sidesOf, stackPadding, withSides, withStackPadding } from 'src/app/boxModel';
import { frameState } from 'src/app/frameState';
import type { Document, Point, Sides } from 'src/app/types';
import { isShapeLocked, isShapeVisible, rotatePoint } from 'src/app/utils';
import type { RestoredEntity } from 'src/app/services/collaboration';
import type { Gesture, HandleTarget } from './types';

type SpacingHandle = Extract<HandleTarget, { type: 'spacing' }>;
type SpacingGesture = Extract<Gesture, { kind: 'spacing' }>;

/** How far a drag goes away from the box across `side`. */
const OUTWARD: Record<Side, Point> = {
    top: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 }
};

/** The sides a spacing grip changes, or undefined when they cannot change now. */
export function spacingOf(document: Document, handle: SpacingHandle): Sides | undefined {
    if (document.locked) {
        return undefined;
    }
    if ('shapeId' in handle) {
        const shape = document.shapes[handle.shapeId];

        return shape &&
            handle.box === 'margin' &&
            isShapeVisible(document, shape.id) &&
            !isShapeLocked(document, shape.id) &&
            frameState(document, shape.parentFrameId)?.lockedBy === undefined
            ? { ...sidesOf(shape.margin) }
            : undefined;
    }
    const frame = document.frames[handle.frameId];

    if (!frame || frameState(document, frame.id)?.lockedBy !== undefined) {
        return undefined;
    }
    if (handle.box === 'padding') {
        return frame.stack ? { ...stackPadding(frame.stack) } : undefined;
    }

    return { ...sidesOf(frame.margin) };
}

/** Writes `sides` as the gesture's box: no margin is saved when every side is zero. */
function write(document: Document, gesture: SpacingGesture, sides: Partial<Sides>) {
    if ('shapeId' in gesture) {
        const shape = document.shapes[gesture.shapeId];

        if (!shape) {
            return;
        }
        const margin = withSides(gesture.original, sides);

        if (margin) {
            shape.margin = margin;
        } else {
            delete shape.margin;
        }

        return;
    }
    const frame = document.frames[gesture.frameId];

    if (!frame) {
        return;
    }
    if (gesture.box === 'padding') {
        if (frame.stack) {
            frame.stack = withStackPadding(
                { ...frame.stack, paddingSides: gesture.original },
                sides
            );
        }

        return;
    }
    const margin = withSides(gesture.original, sides);

    if (margin) {
        frame.margin = margin;
    } else {
        delete frame.margin;
    }
}

/**
 * Sets the dragged side to its width when the drag began plus how far the pointer
 * went away from the box across that side, for margin, or into it, for padding, in
 * whole canvas units. A rotated shape's sides turn with it.
 */
export function dragSpacing(document: Document, gesture: SpacingGesture, from: Point, to: Point) {
    const rotation = 'shapeId' in gesture ? (document.shapes[gesture.shapeId]?.rotation ?? 0) : 0;
    const moved = rotatePoint({ x: to.x - from.x, y: to.y - from.y }, { x: 0, y: 0 }, -rotation);
    const direction = OUTWARD[gesture.side];
    const away = moved.x * direction.x + moved.y * direction.y;
    const value = Math.max(
        0,
        Math.round(gesture.original[gesture.side] + (gesture.box === 'margin' ? away : -away))
    );

    write(document, gesture, { [gesture.side]: value });
}

/** Puts the dragged box back as it was when the drag began. */
export function restoreSpacing(
    document: Document,
    gesture: SpacingGesture,
    restored: RestoredEntity[]
) {
    write(document, gesture, gesture.original);
    restored.push('shapeId' in gesture ? ['shapes', gesture.shapeId] : ['frames', gesture.frameId]);
}
