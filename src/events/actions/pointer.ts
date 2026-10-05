import { json } from 'overmind';
import { Context } from 'src/app';
import { ActionWithParam, Point, Shape } from 'src/app/types';
import { screenToWorld } from 'src/app/camera';
import {
    drawnBox,
    drawnExtent,
    editableSelectedShapesIds,
    groupFrame,
    shownShapesIds
} from 'src/app/membership';
import { SNAP_DISTANCE_PX, snapMove, targetLines } from 'src/app/snapping';
import { beyondClickSlip } from '../gestures';
import { HandleTarget, SelectionSnapshot, ShapesSnapshot, TouchContact } from '../types';

/** A pointer's input; `free` moves without snapping, as while Ctrl or Cmd is held. */
type PointerInput = { pointerId: number; position: Point; free?: boolean };

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

function measurePinch(a: Point, b: Point) {
    return {
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        distance: Math.hypot(a.x - b.x, a.y - b.y)
    };
}

/**
 * Starts a gesture owned by `pointerId` and decides what it does: a handle
 * resizes or rotates its shape, the select tool moves a hit shape or drags a
 * marquee, and any other tool draws. Returns false when another gesture is
 * already in progress. Sharing waits until the gesture ends, so other copies
 * get its result rather than every step.
 */
export const beginGesture = (
    { state, actions, effects }: Context,
    {
        pointerId,
        position,
        handle,
        touch = false
    }: PointerInput & { handle?: HandleTarget; touch?: boolean }
): boolean => {
    const pointer = state.events.pointer;

    if (pointer.gesture.kind !== 'idle') {
        return false;
    }

    effects.collaboration.pause();

    const owner = { pointerId, touch, moved: false };

    pointer.start = position;
    pointer.lastPress = { documentId: state.currentDocumentId, position };
    pointer.current = position;
    pointer.path = [];

    const handleGroup =
        handle && 'groupId' in handle && state.currentDocument.groups[handle.groupId];
    const frame = handleGroup ? groupFrame(state.currentDocument, handleGroup) : null;

    if (handle && 'groupId' in handle && handleGroup && frame) {
        // Hidden shapes follow too; only the frame comes from the shown ones.
        const shapes = snapshotShapes(
            handleGroup.shapesIds
                .map((id) => state.currentDocument.shapes[id])
                .filter((shape) => shape !== undefined)
        );

        pointer.gesture =
            handle.type === 'rotate'
                ? { ...owner, kind: 'rotatingGroup', groupId: handle.groupId, shapes, frame }
                : {
                      ...owner,
                      kind: 'resizingGroup',
                      groupId: handle.groupId,
                      handle: handle.type,
                      shapes,
                      frame
                  };

        return true;
    }

    const handleShape =
        handle && 'shapeId' in handle && state.currentDocument.shapes[handle.shapeId];

    if (handle && 'shapeId' in handle && handleShape) {
        const shapes = snapshotShapes([handleShape]);

        pointer.gesture =
            handle.type === 'rotate'
                ? { ...owner, kind: 'rotating', shapeId: handle.shapeId, shapes }
                : {
                      ...owner,
                      kind: 'resizing',
                      shapeId: handle.shapeId,
                      handle: handle.type,
                      shapes
                  };

        return true;
    }

    if (state.tools.activeToolsIds[0] !== 'select') {
        pointer.gesture = { ...owner, kind: 'drawing' };

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
            ...owner,
            kind: 'moving',
            selection,
            shapes: snapshotShapes(selected),
            dragged: false,
            box: null,
            movingIds: [],
            movedBy: { x: 0, y: 0 },
            snapLines: { x: null, y: null }
        };

        return true;
    }

    pointer.gesture = { ...owner, kind: 'marquee', selection };

    return true;
};

/**
 * Tracks the pointer; input from a pointer that does not own the gesture, and
 * any pointer input during a pinch, is ignored.
 */
/**
 * When a drag begins: the box of the shapes it moves, which snaps, and the lines
 * of the other shown shapes it snaps to, kept in `dragTargets`.
 */
const takeSnapTargets = ({ state, effects }: Pick<Context, 'state' | 'effects'>) => {
    const movingIds = editableSelectedShapesIds(state.currentDocument);
    const moving = new Set(movingIds);
    // Read without the store's tracking: thousands of shapes are only looked at here.
    const document = json(state.currentDocument);
    const others = [...shownShapesIds(document)].filter((id) => !moving.has(id));

    effects.dragTargets.take(targetLines(others.map((id) => drawnBox(document.shapes[id]))));

    return { movingIds, box: drawnExtent(document, movingIds) };
};

export const movePointer = (
    { state, actions, effects }: Context,
    { pointerId, position, free = false }: PointerInput
) => {
    const pointer = state.events.pointer;
    const { gesture } = pointer;

    if (
        gesture.kind === 'pinching' ||
        (gesture.kind !== 'idle' && gesture.pointerId !== pointerId)
    ) {
        return;
    }

    const previous = pointer.current;

    pointer.current = position;

    if (!pointer.inside) {
        pointer.inside = true;
    }

    if (
        gesture.kind !== 'idle' &&
        !gesture.moved &&
        (position.x !== previous.x || position.y !== previous.y)
    ) {
        gesture.moved = true;
    }

    if (gesture.kind === 'drawing') {
        pointer.path.push(position);
    }

    if (gesture.kind === 'marquee') {
        actions.selectShapes();
    }

    // A pointer that slips during a click moves nothing; beyond that, the shapes
    // follow it from where it was pressed, snapping unless the move is free.
    if (
        gesture.kind === 'moving' &&
        (gesture.dragged ||
            beyondClickSlip(pointer.start, position, state.currentDocument.camera.scale))
    ) {
        if (!gesture.dragged) {
            gesture.dragged = true;
            const { movingIds, box } = takeSnapTargets({ state, effects });

            gesture.movingIds = movingIds;
            gesture.box = box;
        }

        const { scale } = state.currentDocument.camera;
        const targets = effects.dragTargets.current();
        const pulled = { x: position.x - pointer.start.x, y: position.y - pointer.start.y };
        const { delta, lines } =
            free || !gesture.box || !targets
                ? { delta: pulled, lines: { x: null, y: null } }
                : snapMove(json(gesture.box), pulled, targets, SNAP_DISTANCE_PX / scale);
        const step = { x: delta.x - gesture.movedBy.x, y: delta.y - gesture.movedBy.y };

        if (step.x !== 0 || step.y !== 0) {
            actions.moveShapesBy({ shapeIds: gesture.movingIds, delta: step });
            gesture.movedBy = delta;
        }

        if (gesture.snapLines.x !== lines.x || gesture.snapLines.y !== lines.y) {
            gesture.snapLines = lines;
        }
    }

    if (gesture.kind === 'resizing') {
        actions.resizeShape({
            shapeId: gesture.shapeId,
            handlerType: gesture.handle,
            position,
            original: gesture.shapes[gesture.shapeId]
        });
    }

    if (gesture.kind === 'rotating') {
        actions.rotateShape({ shapeId: gesture.shapeId, position });
    }

    if (gesture.kind === 'resizingGroup') {
        const { groupId, handle, shapes, frame } = gesture;

        actions.resizeGroup({ groupId, handle, position, shapes, frame });
    }

    if (gesture.kind === 'rotatingGroup') {
        const { groupId, shapes, frame } = gesture;

        actions.rotateGroup({ groupId, position, shapes, frame });
    }
};

/** The pointer left the canvas, so what it was over there is no longer under it. */
export const leaveSurface = ({ state }: Context) => {
    state.events.pointer.inside = false;
};

/**
 * Completes the owner's gesture at its release position. Drawing and marquee
 * gestures commit through the active tool exactly once; the other gestures
 * edit shapes live and have nothing left to commit.
 */
export const endGesture = (
    { state, actions, effects }: Context,
    { pointerId, position, free }: PointerInput
) => {
    const pointer = state.events.pointer;
    const { gesture } = pointer;

    if (gesture.kind === 'idle' || gesture.kind === 'pinching' || gesture.pointerId !== pointerId) {
        return;
    }

    actions.events.movePointer({ pointerId, position, free });

    // A click, rather than a drag, on a shape of a group selected before it enters the group.
    if (gesture.kind === 'moving' && !gesture.dragged) {
        actions.enterClickedGroup(gesture.selection);
    }

    if (gesture.kind === 'drawing' || gesture.kind === 'marquee') {
        actions.tools.executeToolCommands();
    }

    effects.dragTargets.clear();
    pointer.gesture = { kind: 'idle' };
    actions.tools.resetTools();
    effects.collaboration.resume();
};

/**
 * Abandons the gesture without committing it and restores the shapes and
 * selection it changed, keeping what other copies changed meanwhile. With a `pointerId`, only that pointer's gesture is
 * canceled; a pinch is only canceled without one (blur, context menu, unmount).
 * Returns the owner of the canceled gesture so the caller can release its
 * capture.
 */
export const cancelGesture = (
    { state, actions, effects }: Context,
    pointerId?: number
): number | null => {
    const pointer = state.events.pointer;
    const { gesture } = pointer;

    if (gesture.kind === 'pinching' && pointerId === undefined) {
        pointer.gesture = { kind: 'idle' };

        return null;
    }

    if (
        gesture.kind === 'idle' ||
        gesture.kind === 'pinching' ||
        (pointerId !== undefined && gesture.pointerId !== pointerId)
    ) {
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

    if ('frame' in gesture) {
        const group = state.currentDocument.groups[gesture.groupId];

        if (group) {
            group.rotation = gesture.frame.rotation;
        }
    }

    if ('selection' in gesture) {
        Object.entries(gesture.selection).forEach(([id, selected]) => {
            const shape = state.currentDocument.shapes[id];

            if (shape && shape.selected !== selected) {
                shape.selected = selected;
            }
        });
    }

    effects.dragTargets.clear();
    const owner = gesture.pointerId;

    pointer.gesture = { kind: 'idle' };
    actions.tools.resetTools();
    effects.collaboration.resume();

    return owner;
};

/**
 * Starts a two-finger pinch from the first two touch contacts. A pinch may only
 * replace a touch gesture whose contact has not moved yet; an active drag keeps
 * its mode. The world point under the contacts' midpoint becomes the anchor.
 */
export const beginPinch = ({ state, actions }: Context, contacts: TouchContact[]) => {
    const { gesture } = state.events.pointer;
    const [a, b] = contacts;

    if (
        !a ||
        !b ||
        gesture.kind === 'pinching' ||
        (gesture.kind !== 'idle' && (!gesture.touch || gesture.moved))
    ) {
        return;
    }

    const { center, distance } = measurePinch(a.point, b.point);
    const { camera } = state.currentDocument;
    const anchor = screenToWorld(center, camera);

    if (!anchor || !Number.isFinite(distance) || distance <= 0) {
        return;
    }

    actions.events.cancelGesture();

    state.events.pointer.gesture = {
        kind: 'pinching',
        touchIds: [a.id, b.id],
        distance,
        scale: camera.scale,
        anchor
    };
};

/** Scales by the change in finger distance and keeps the anchor between the fingers. */
export const updatePinch = ({ state, actions }: Context, contacts: TouchContact[]) => {
    const { gesture } = state.events.pointer;

    if (gesture.kind !== 'pinching') {
        return;
    }

    const a = contacts.find((contact) => contact.id === gesture.touchIds[0]);
    const b = contacts.find((contact) => contact.id === gesture.touchIds[1]);

    // Once either finger lifts, the remaining contact stays inert.
    if (!a || !b) {
        return;
    }

    const { center, distance } = measurePinch(a.point, b.point);

    if (!Number.isFinite(distance) || distance <= 0) {
        return;
    }

    actions.tools.zoomToAnchor({
        scale: (gesture.scale * distance) / gesture.distance,
        anchor: gesture.anchor,
        point: center
    });
};

/** Ends the pinch once no touch contact remains. */
export const endPinch = ({ state }: Context, remainingContacts: number) => {
    if (state.events.pointer.gesture.kind === 'pinching' && remainingContacts === 0) {
        state.events.pointer.gesture = { kind: 'idle' };
    }
};
