import { json } from 'overmind';
import { Context } from 'src/app';
import { ActionWithParam, Point, Shape } from 'src/app/types';
import { screenToWorld } from 'src/app/camera';
import { drawnBox, drawnExtent, groupFrame, shownShapesIds } from 'src/app/membership';
import {
    SNAP_DISTANCE_PX,
    linesOnEdges,
    sameGaps,
    snapMove,
    snapResize,
    targetLines
} from 'src/app/snapping';
import { untracked } from 'src/app/untracked';
import { getShapeBounds } from 'src/app/utils';
import { keepsAspectRatio } from 'src/app/geometry';
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
                      frame,
                      snapLines: { x: null, y: null }
                  };

        return true;
    }

    const handleShape =
        handle && 'shapeId' in handle && state.currentDocument.shapes[handle.shapeId];

    if (handle && 'shapeId' in handle && handleShape) {
        const shapes = snapshotShapes([handleShape]);

        if (handle.type === 'radius') {
            pointer.gesture = {
                ...owner,
                kind: 'rounding',
                shapeId: handle.shapeId,
                corner: handle.corner,
                shapes
            };

            return true;
        }

        pointer.gesture =
            handle.type === 'rotate'
                ? { ...owner, kind: 'rotating', shapeId: handle.shapeId, shapes }
                : {
                      ...owner,
                      kind: 'resizing',
                      shapeId: handle.shapeId,
                      handle: handle.type,
                      shapes,
                      snapLines: { x: null, y: null }
                  };

        return true;
    }

    if (state.tools.activeToolsIds[0] !== 'select') {
        pointer.gesture = { ...owner, kind: 'drawing' };

        return true;
    }

    // Snapshot before hit-testing: pressing a shape may change the selection.
    const selection = snapshotSelection(untracked(state.currentDocument.shapes));

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
            snapLines: { x: null, y: null },
            equalGaps: []
        };

        return true;
    }

    pointer.gesture = { ...owner, kind: 'marquee', selection, dragged: false };

    return true;
};

/**
 * Tracks the pointer; input from a pointer that does not own the gesture, and
 * any pointer input during a pinch, is ignored.
 */
/**
 * When a drag begins: the lines of the shown shapes other than `changingIds` that
 * they snap to, kept in `dragTargets`, and the box they are drawn in.
 */
const takeSnapTargets = (
    { state, effects }: Pick<Context, 'state' | 'effects'>,
    changingIds: string[]
) => {
    const changing = new Set(changingIds);
    // Read without the store's tracking: thousands of shapes are only looked at here.
    const document = untracked(state.currentDocument);
    const others = [...shownShapesIds(document)].filter((id) => !changing.has(id));

    effects.dragTargets.take(targetLines(others.map((id) => drawnBox(document.shapes[id]))));

    return drawnExtent(document, changingIds);
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

    // Within a click's slip the box selects nothing yet, so a click keeps the selection.
    if (
        gesture.kind === 'marquee' &&
        (gesture.dragged ||
            beyondClickSlip(pointer.start, position, state.currentDocument.camera.scale))
    ) {
        gesture.dragged = true;
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
            gesture.movingIds = state.currentDocument.editableSelectedShapesIds;
            gesture.box = takeSnapTargets({ state, effects }, gesture.movingIds);
        }

        const { scale } = state.currentDocument.camera;
        const targets = effects.dragTargets.current();
        const pulled = { x: position.x - pointer.start.x, y: position.y - pointer.start.y };
        const { delta, lines, gaps } =
            free || !gesture.box || !targets
                ? { delta: pulled, lines: { x: null, y: null }, gaps: [] }
                : snapMove(json(gesture.box), pulled, targets, SNAP_DISTANCE_PX / scale);
        const step = { x: delta.x - gesture.movedBy.x, y: delta.y - gesture.movedBy.y };

        if (step.x !== 0 || step.y !== 0) {
            actions.moveShapesBy({ shapeIds: gesture.movingIds, delta: step });
            gesture.movedBy = delta;
        }

        if (gesture.snapLines.x !== lines.x || gesture.snapLines.y !== lines.y) {
            gesture.snapLines = lines;
        }

        if (!sameGaps(json(gesture.equalGaps), gaps)) {
            gesture.equalGaps = gaps;
        }
    }

    if (gesture.kind === 'resizing' || gesture.kind === 'resizingGroup') {
        const resizing = gesture.kind === 'resizing';
        const original = resizing ? gesture.shapes[gesture.shapeId] : undefined;
        const changingIds = resizing ? [gesture.shapeId] : Object.keys(gesture.shapes);
        const rotation = resizing ? (original?.rotation ?? 0) : gesture.frame.rotation;
        const upright = rotation % 90 === 0;
        const startBox =
            gesture.kind === 'resizingGroup'
                ? gesture.frame.box
                : original && getShapeBounds(original);
        const proportional =
            gesture.kind === 'resizingGroup' ||
            (original !== undefined && keepsAspectRatio(original));

        if (!free && upright && !effects.dragTargets.current()) {
            takeSnapTargets({ state, effects }, changingIds);
        }

        const targets = free || !upright ? null : effects.dragTargets.current();
        const { scale } = state.currentDocument.camera;
        const snapped =
            targets && startBox
                ? snapResize(
                      startBox,
                      gesture.handle,
                      position,
                      proportional,
                      rotation,
                      targets,
                      SNAP_DISTANCE_PX / scale
                  )
                : { point: position, lines: { x: null, y: null } };

        if (resizing) {
            actions.resizeShape({
                shapeId: gesture.shapeId,
                handlerType: gesture.handle,
                position: snapped.point,
                original: gesture.shapes[gesture.shapeId]
            });
        } else {
            const { groupId, handle, shapes, frame } = gesture;

            actions.resizeGroup({ groupId, handle, position: snapped.point, shapes, frame });
        }

        // Its group and layer are shown, so each shape's own flag says whether it is drawn.
        const document = untracked(state.currentDocument);
        const box = drawnExtent(
            document,
            changingIds.filter((id) => document.shapes[id]?.visible)
        );
        const lines = box ? linesOnEdges(snapped.lines, box) : { x: null, y: null };

        if (gesture.snapLines.x !== lines.x || gesture.snapLines.y !== lines.y) {
            gesture.snapLines = lines;
        }
    }

    if (gesture.kind === 'rotating') {
        actions.rotateShape({ shapeId: gesture.shapeId, position });
    }

    if (gesture.kind === 'rounding') {
        actions.roundCorners({
            shapeId: gesture.shapeId,
            corner: gesture.corner,
            from: pointer.start,
            to: position,
            original: gesture.shapes[gesture.shapeId]
        });
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

    // A press passes through a locked item, which a click still selects.
    const clickedLockedItem =
        gesture.kind === 'marquee' && !gesture.dragged && actions.selectClickedShapes();

    if (!clickedLockedItem && (gesture.kind === 'drawing' || gesture.kind === 'marquee')) {
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
                const restored = json(snapshot);

                // A field the gesture added, such as a corner radius, goes as well.
                Object.keys(shape)
                    .filter((key) => !(key in restored))
                    .forEach((key) => Reflect.deleteProperty(shape, key));
                Object.assign(shape, restored, { active: shape.active });
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
