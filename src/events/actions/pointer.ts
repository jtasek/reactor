import { json } from 'overmind';
import { Context } from '../../app';
import { ActionWithParam, Point, Shape } from '../../app/types';
import { HandleTarget, SelectionSnapshot, ShapesSnapshot } from '../types';

type PointerInput = { pointerId: number; position: Point };

export const setStartPosition: ActionWithParam<Point> = ({ state }, position) => {
    state.events.pointer.start = position;
};

export const setCurrentPosition: ActionWithParam<Point> = ({ state }, position) => {
    state.events.pointer.current = position;
};

export const updatePath: ActionWithParam<Point> = ({ state }, position) => {
    state.events.pointer.path.push(position);
};

function snapshotSelection(shapes: Record<string, Shape>): SelectionSnapshot {
    return Object.fromEntries(Object.values(shapes).map((shape) => [shape.id, shape.selected]));
}

function snapshotShapes(shapes: Shape[]): ShapesSnapshot {
    return Object.fromEntries(shapes.map((shape) => [shape.id, json(shape)]));
}

/**
 * Starts a gesture owned by `pointerId` and decides what it does: a handle
 * resizes or rotates its shape, the select tool moves a hit shape or drags a
 * marquee, and any other tool draws. Returns false when another gesture is
 * already in progress.
 */
export const beginGesture = (
    { state, actions }: Context,
    { pointerId, position, handle }: PointerInput & { handle?: HandleTarget }
): boolean => {
    const pointer = state.events.pointer;

    if (pointer.gesture.kind !== 'idle') {
        return false;
    }

    pointer.start = position;
    pointer.current = position;
    pointer.path = [];

    const handleShape = handle && state.currentDocument.shapes[handle.shapeId];

    if (handle && handleShape) {
        const shapes = snapshotShapes([handleShape]);

        pointer.gesture =
            handle.type === 'rotate'
                ? { kind: 'rotating', pointerId, shapeId: handle.shapeId, shapes }
                : {
                      kind: 'resizing',
                      pointerId,
                      shapeId: handle.shapeId,
                      handle: handle.type,
                      shapes
                  };

        return true;
    }

    if (state.tools.activeToolsIds[0] !== 'select') {
        pointer.gesture = { kind: 'drawing', pointerId };

        return true;
    }

    // Snapshot before hit-testing: pressing a shape may change the selection.
    const selection = snapshotSelection(state.currentDocument.shapes);

    if (actions.selectShapeAtPointer()) {
        const selected = Object.values(state.currentDocument.shapes).filter(
            (shape) => shape.selected
        );

        actions.tools.activateTool('move');
        pointer.gesture = {
            kind: 'moving',
            pointerId,
            selection,
            shapes: snapshotShapes(selected)
        };

        return true;
    }

    pointer.gesture = { kind: 'marquee', pointerId, selection };

    return true;
};

/** Tracks the pointer; input from a pointer that does not own the gesture is ignored. */
export const movePointer = ({ state, actions }: Context, { pointerId, position }: PointerInput) => {
    const pointer = state.events.pointer;
    const { gesture } = pointer;

    if (gesture.kind !== 'idle' && gesture.pointerId !== pointerId) {
        return;
    }

    const previous = pointer.current;

    pointer.current = position;

    if (gesture.kind === 'drawing') {
        pointer.path.push(position);
    }

    if (gesture.kind === 'marquee') {
        actions.selectShapes();
    }

    if (gesture.kind === 'moving') {
        actions.moveSelectedShapes({ x: position.x - previous.x, y: position.y - previous.y });
    }

    if (gesture.kind === 'resizing') {
        actions.resizeShape({ shapeId: gesture.shapeId, handlerType: gesture.handle, position });
    }

    if (gesture.kind === 'rotating') {
        actions.rotateShape({ shapeId: gesture.shapeId, position });
    }
};

/**
 * Completes the owner's gesture at its release position. Drawing and marquee
 * gestures commit through the active tool exactly once; the other gestures
 * edit shapes live and have nothing left to commit.
 */
export const endGesture = ({ state, actions }: Context, { pointerId, position }: PointerInput) => {
    const pointer = state.events.pointer;
    const { gesture } = pointer;

    if (gesture.kind === 'idle' || gesture.pointerId !== pointerId) {
        return;
    }

    actions.events.movePointer({ pointerId, position });

    if (gesture.kind === 'drawing' || gesture.kind === 'marquee') {
        actions.tools.executeToolCommands();
    }

    pointer.gesture = { kind: 'idle' };
    actions.tools.resetTools();
};

/**
 * Abandons the gesture without committing it and restores the shapes and
 * selection it changed. With a `pointerId`, only that pointer's gesture is
 * canceled. Returns the owner of the canceled gesture so the caller can release
 * its capture.
 */
export const cancelGesture = ({ state, actions }: Context, pointerId?: number): number | null => {
    const pointer = state.events.pointer;
    const { gesture } = pointer;

    if (gesture.kind === 'idle' || (pointerId !== undefined && gesture.pointerId !== pointerId)) {
        return null;
    }

    if ('shapes' in gesture) {
        Object.entries(gesture.shapes).forEach(([id, snapshot]) => {
            const shape = state.currentDocument.shapes[id];

            // Restore what the gesture edited, but keep the live hover state.
            if (shape) {
                Object.assign(shape, json(snapshot), { active: shape.active });
            }
        });
    }

    if ('selection' in gesture) {
        Object.entries(gesture.selection).forEach(([id, selected]) => {
            const shape = state.currentDocument.shapes[id];

            if (shape && shape.selected !== selected) {
                shape.selected = selected;
            }
        });
    }

    const owner = gesture.pointerId;

    pointer.gesture = { kind: 'idle' };
    actions.tools.resetTools();

    return owner;
};
