import {
    frameState,
    isFrameVisible,
    isFrameLocked,
    lockedFrameForShapes,
    unselectHiddenFrameShapes
} from './frameState';
import { json } from 'overmind';
import type { Context } from './index';
import type { Frame, Point, ResizeHandlerType, Shape } from './types';
import type { Gesture } from 'src/events/types';
import type { RemoteChanges, ViewChange } from './services/collaboration';
import type { RestoredEntity } from './services/collaboration';
import { readEntity, orUndefined, MIN_FRAME_SIZE } from './services/documentStorage';
import { isReadOnly } from './documentAccess';
import { numberedName } from './factories';
import { resizeBox, assertNever, isShapeVisible } from './utils';
import { withTheirGroups } from './membership';
import { unbindMovedProperties } from './variables';
import { CLONE_OFFSET, translateShape } from './geometry';
import {
    deleteFrame,
    frameContents,
    frameParents,
    validFrameParent,
    frameMoveProblem
} from './frameMembership';
import { editorHelpers } from './editorHelpers';
import { untracked } from './untracked';

export type FrameEdit =
    | { kind: 'add'; position: Point; size: Frame['size'] }
    | { kind: 'select'; id: string }
    | { kind: 'reparentShapes'; ids: string[]; parentFrameId: string | null }
    | { kind: 'update'; id: string; changes: import('./operations').UpdateFrame['changes'] }
    | { kind: 'delete'; id: string; documentId?: string }
    | { kind: 'cut'; id: string; documentId?: string; frameIds: string[]; shapeIds: string[] }
    | { kind: 'clone'; id: string }
    | { kind: 'toggle'; id: string; flag: 'locked' | 'visible' }
    | { kind: 'paste'; frame: Frame; target: Point | null; copied?: CopiedFrame };

export const frameBox = (frame: Frame) => ({
    topLeft: frame.position,
    bottomRight: {
        x: frame.position.x + frame.size.width,
        y: frame.position.y + frame.size.height
    },
    ...frame.size
});

const frameName = (frames: Record<string, Frame>, name = 'Frame') => {
    const taken = new Set(Object.values(frames).map((frame) => frame.name));

    return taken.has(name) ? numberedName(name, taken) : name;
};

function addFrame(context: Context, input: Extract<FrameEdit, { kind: 'add' | 'paste' }>) {
    const { state, actions, effects } = context;
    const document = state.currentDocument;
    const source = input.kind === 'paste' ? input.frame : undefined;
    const position =
        input.kind === 'add'
            ? input.position
            : {
                  x: input.target
                      ? input.target.x - input.frame.size.width / 2
                      : input.frame.position.x + CLONE_OFFSET.x,
                  y: input.target
                      ? input.target.y - input.frame.size.height / 2
                      : input.frame.position.y + CLONE_OFFSET.y
              };
    const frame = orUndefined(() =>
        readEntity('frames', {
            id: effects.newId(),
            name: frameName(document.frames, source?.name),
            position,
            size: input.kind === 'add' ? input.size : input.frame.size,
            ...(source?.parentFrameId === undefined ? {} : { parentFrameId: source.parentFrameId }),
            locked: false,
            visible: true
        })
    );

    if (!frame) {
        return;
    }

    if (input.kind === 'add') {
        document.frames[frame.id] = frame;

        return actions.editFrame({ kind: 'select', id: frame.id });
    }

    const result = actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: framePasteOperations(input, frame, document)
    });

    if (!result.applied) {
        return;
    }

    return actions.editFrame({ kind: 'select', id: result.ids.frame });
}

function framePasteOperations(
    input: Extract<FrameEdit, { kind: 'paste' }>,
    frame: Frame,
    document: Context['state']['currentDocument']
): import('./operations').Operation[] {
    const copied = input.copied;

    if (!copied) {
        return [{ op: 'addFrame', key: 'frame', frame }];
    }

    const delta = {
        x: frame.position.x - copied.frame.position.x,
        y: frame.position.y - copied.frame.position.y
    };
    const keys = new Map([
        [copied.frame.id, 'frame'],
        ...copied.children.map((child, index) => [child.id, `frame:${index}`] as const)
    ]);
    const pending = new Map(copied.children.map((child) => [child.id, child]));
    const ordered: Frame[] = [];
    const emitted = new Set([copied.frame.id]);

    while (pending.size > 0) {
        for (const [id, child] of pending) {
            if (child.parentFrameId !== undefined && emitted.has(child.parentFrameId)) {
                ordered.push(child);
                emitted.add(id);
                pending.delete(id);
            }
        }
    }

    const taken = new Set([
        ...Object.values(document.frames).map((child) => child.name),
        frame.name
    ]);
    const children = ordered.map((child): import('./operations').AddFrame => {
        const name = taken.has(child.name) ? numberedName(child.name, taken) : child.name;
        taken.add(name);

        return {
            op: 'addFrame',
            key: keys.get(child.id)!,
            frame: {
                ...child,
                name,
                parentFrameId: keys.get(child.parentFrameId!),
                position: { x: child.position.x + delta.x, y: child.position.y + delta.y }
            }
        };
    });
    const artwork = structuredClone(copied.artwork);
    artwork.shapes.forEach((shape) => {
        shape.parentFrameId = keys.get(shape.parentFrameId!);
    });

    return [
        { op: 'addFrame', key: 'frame', frame },
        ...children,
        ...(artwork.shapes.length > 0
            ? editorHelpers().clipboard.pasteOperations(artwork, document, null, delta)
            : [])
    ];
}

export function edit(context: Context, input: FrameEdit): string | undefined {
    const { state, actions } = context;
    const document = state.currentDocument;

    if (isReadOnly(state) || (document.editingComponentId && input.kind !== 'select')) {
        return;
    }

    if (input.kind === 'select') {
        if (!document.frames[input.id]) {
            return;
        }

        actions.unselectShapes();
        document.selectedFrameId = input.id;

        return input.id;
    }

    if (
        document.locked ||
        (state.events.pointer.gesture.kind !== 'idle' &&
            !(input.kind === 'add' && state.events.pointer.gesture.kind === 'drawing'))
    ) {
        return;
    }

    if (input.kind === 'add' || input.kind === 'paste') {
        return addFrame(context, input);
    }

    if (input.kind === 'reparentShapes') {
        const ids = [...withTheirGroups(document, input.ids, null)];

        if (document.editingComponentId || ids.some((id) => document.componentMembersIds.has(id))) {
            return;
        }

        const result = actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: ids.map((id) => ({
                op: 'updateShape',
                shape: id,
                changes: { parentFrameId: input.parentFrameId }
            }))
        });

        return result.applied ? (input.parentFrameId ?? document.id) : undefined;
    }

    const frame = document.frames[input.id];

    if (input.kind === 'toggle') {
        if (
            !frame ||
            (frameState(document, frame.id)?.lockedBy !== undefined &&
                frameState(document, frame.id)?.lockedBy !== frame.id)
        ) {
            return;
        }

        frame[input.flag] = !frame[input.flag];

        if (document.selectedFrameId && !isFrameVisible(document, document.selectedFrameId)) {
            delete document.selectedFrameId;
        }

        unselectHiddenFrameShapes(document);

        return frame.id;
    }

    if (!frame || isFrameLocked(document, frame.id)) {
        return;
    }

    if (input.kind === 'cut') {
        if (input.documentId !== document.id) {
            return;
        }

        actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [
                ...input.frameIds
                    .filter((id) => document.frames[id])
                    .map((id): import('./operations').DeleteFrame => ({
                        op: 'deleteFrame',
                        frame: id
                    })),
                ...(input.shapeIds.length > 0
                    ? [
                          {
                              op: 'deleteShapes' as const,
                              shapes: input.shapeIds.filter((id) => document.shapes[id])
                          }
                      ]
                    : [])
            ]
        });

        return;
    }

    if (input.kind === 'delete') {
        if (input.documentId && input.documentId !== document.id) {
            return;
        }

        deleteFrame(document, frame.id);

        return;
    }

    if (input.kind === 'clone') {
        const copied = readClipboard(writeClipboard(frame, document));
        // A clone stays beside its original, in the parent the view shows.
        const parentFrameId = frameParents(untracked(document).frames).get(frame.id);

        return copied
            ? actions.editFrame({
                  kind: 'paste',
                  frame: { ...copied.frame, ...(parentFrameId ? { parentFrameId } : {}) },
                  copied,
                  target: null
              })
            : undefined;
    }

    const result = editorHelpers().operations.stageBatch(
        untracked(document),
        [{ op: 'updateFrame', frame: frame.id, changes: input.changes }],
        context.effects.newId
    );

    if (!result.valid) {
        return;
    }

    editorHelpers().operations.writeBatch(document, result.staged);

    return frame.id;
}

const shapePlacement = (shape: Shape) => {
    switch (shape.type) {
        case 'line':
            return { start: shape.start, end: shape.end, bounds: shape.bounds };
        case 'pen':
            return { points: shape.points, bounds: shape.bounds };
        case 'rectangle':
        case 'image':
        case 'circle':
        case 'ellipse':
        case 'text':
        case 'instance':
            return { position: shape.position, bounds: shape.bounds };
        default:
            return assertNever(shape);
    }
};

export function begin(
    context: Pick<Context, 'state' | 'actions' | 'effects'>,
    owner: { pointerId: number; touch: boolean; moved: boolean; selectedFrameId?: string },
    handle: { frameId: string; type: ResizeHandlerType | 'move' }
) {
    const { state, actions, effects } = context;
    const frame = state.currentDocument.frames[handle.frameId];

    if (
        !frame ||
        !isFrameVisible(state.currentDocument, frame.id) ||
        isFrameLocked(state.currentDocument, frame.id) ||
        state.currentDocument.locked ||
        isReadOnly(state)
    ) {
        effects.collaboration.resume();

        return false;
    }

    const document = untracked(state.currentDocument);
    const contents =
        handle.type === 'move' ? frameContents(document, frame.id) : { frames: [], shapes: [] };

    if (handle.type === 'move' && frameMoveProblem(document, frame.id)) {
        effects.collaboration.resume();

        return false;
    }

    const selection = Object.fromEntries(
        Object.values(document.shapes).map((shape) => [shape.id, shape.selected])
    );

    actions.editFrame({ kind: 'select', id: frame.id });
    state.events.pointer.gesture = {
        ...owner,
        kind: 'editingFrame',
        selection,
        frameId: frame.id,
        originalFrame: json(frame),
        childFrames: Object.fromEntries(
            contents.frames.map((id) => [id, json(document.frames[id])])
        ),
        shapes: Object.fromEntries(contents.shapes.map((id) => [id, json(document.shapes[id])])),
        handle: handle.type
    };

    return true;
}

export function move({ state, actions }: Pick<Context, 'state' | 'actions'>, position: Point) {
    const { gesture, start } = state.events.pointer;

    if (gesture.kind !== 'editingFrame') {
        return;
    }

    if (gesture.invalidated) {
        actions.events.cancelGesture();

        return;
    }

    if (!gesture.moved) {
        return;
    }

    const frame = state.currentDocument.frames[gesture.frameId];

    if (!frame || isFrameLocked(state.currentDocument, frame.id) || isReadOnly(state)) {
        return;
    }

    if (gesture.handle === 'move') {
        const delta = { x: position.x - start.x, y: position.y - start.y };
        Object.entries(gesture.childFrames).forEach(([id, original]) => {
            const child = state.currentDocument.frames[id];

            if (child) {
                child.position = {
                    x: original.position.x + delta.x,
                    y: original.position.y + delta.y
                };
            }
        });
        Object.entries(gesture.shapes).forEach(([id, original]) => {
            const child = state.currentDocument.shapes[id];

            if (child) {
                const translated = json(original);
                translateShape(translated, delta);
                Object.assign(child, shapePlacement(translated));
                unbindMovedProperties(child, delta);
            }
        });
        frame.position = {
            x: gesture.originalFrame.position.x + position.x - start.x,
            y: gesture.originalFrame.position.y + position.y - start.y
        };

        return;
    }

    const box = resizeBox(
        frameBox(gesture.originalFrame),
        gesture.handle,
        position,
        MIN_FRAME_SIZE
    );
    frame.position = { ...box.topLeft };
    frame.size = { width: box.width, height: box.height };
}

export function cancel({ state }: Pick<Context, 'state'>, restored: RestoredEntity[]) {
    const { gesture } = state.events.pointer;

    if (gesture.kind !== 'editingFrame') {
        return;
    }

    Object.entries(gesture.childFrames).forEach(([id, original]) => {
        const frame = state.currentDocument.frames[id];

        if (frame) {
            Object.assign(frame, json(original));
            restored.push(['frames', id]);
        }
    });

    const frame = state.currentDocument.frames[gesture.frameId];

    if (frame) {
        Object.assign(frame, json(gesture.originalFrame));
        restored.push(['frames', frame.id]);
    }
}

const FORMAT = 'reactor/frame';
export interface CopiedFrame {
    frame: Frame;
    children: Frame[];
    artwork: import('./clipboard').Copied;
}

export function writeClipboard(frame: Frame, document?: Context['state']['currentDocument']) {
    const contents = document
        ? frameContents(untracked(document), frame.id)
        : { frames: [], shapes: [] };
    const shapes = document
        ? document.shapesIds
              .filter((id) => contents.shapes.includes(id))
              .map((id) => document.shapes[id])
        : [];
    const root = { ...readEntity('frames', frame) };
    delete root.parentFrameId;

    return JSON.stringify({
        format: FORMAT,
        frame: root,
        children: document
            ? contents.frames.map((id) => readEntity('frames', document.frames[id]))
            : [],
        artwork: document
            ? editorHelpers().clipboard.writeClipboard(
                  shapes,
                  Object.values(document.groups),
                  document.variables,
                  document
              )
            : undefined,
        members: shapes.map((shape) => ({
            parentFrameId: shape.parentFrameId,
            locked: shape.locked,
            visible: shape.visible
        }))
    });
}

export function readClipboard(text: string): CopiedFrame | undefined {
    return orUndefined(() => {
        const data = JSON.parse(text);

        if (data.format !== FORMAT) {
            return;
        }

        const frame = readEntity('frames', data.frame);
        const children: Frame[] = (data.children ?? []).map((child: unknown) =>
            readEntity('frames', child)
        );
        const frames = Object.fromEntries([frame, ...children].map((child) => [child.id, child]));

        if (
            Object.keys(frames).length !== children.length + 1 ||
            frame.parentFrameId !== undefined ||
            children.some(
                (child) =>
                    !validFrameParent(frames, child.id, child.parentFrameId) ||
                    child.parentFrameId === undefined
            )
        ) {
            return;
        }

        const artwork = editorHelpers().clipboard.readClipboard(data.artwork ?? '');

        if (data.artwork !== undefined) {
            const source = JSON.parse(data.artwork);

            if (
                source.format !== 'reactor/shapes' ||
                !Array.isArray(source.shapes) ||
                source.shapes.length !== artwork.shapes.length
            ) {
                return;
            }
        }

        const members = data.members ?? [];

        if (
            !Array.isArray(members) ||
            members.length !== artwork.shapes.length ||
            members.some(
                (member) =>
                    typeof member?.parentFrameId !== 'string' ||
                    !Object.hasOwn(frames, member.parentFrameId) ||
                    typeof member.locked !== 'boolean' ||
                    typeof member.visible !== 'boolean'
            )
        ) {
            return;
        }

        artwork.shapes.forEach((shape, index) => {
            const member = members[index];
            Object.assign(shape, {
                parentFrameId: member.parentFrameId,
                locked: member.locked,
                visible: member.visible
            });
        });

        return { frame, children, artwork };
    });
}

/** An ancestor may be hidden or locked remotely after a gesture starts. */
export function gestureBlocked(document: Context['state']['currentDocument'], gesture: Gesture) {
    if (gesture.kind === 'editingFrame') {
        return (
            !isFrameVisible(document, gesture.frameId) || isFrameLocked(document, gesture.frameId)
        );
    }

    if (!('shapes' in gesture)) {
        return false;
    }

    const ids =
        gesture.kind === 'moving'
            ? gesture.dragged
                ? gesture.movingIds
                : document.editableSelectedShapesIds
            : Object.keys(gesture.shapes);

    if (lockedFrameForShapes(document, ids)) {
        return true;
    }

    if (
        gesture.kind === 'resizingGroup' ||
        gesture.kind === 'rotatingGroup' ||
        gesture.kind === 'resizingComponent' ||
        gesture.kind === 'rotatingComponent'
    ) {
        // Hidden members follow a visible container, just as they did at the press.
        return ids.every((id) => !isShapeVisible(document, id));
    }

    return ids.some(
        (id) => frameState(document, document.shapes[id]?.parentFrameId)?.hiddenBy !== undefined
    );
}

/** Keep frame-specific gesture bookkeeping with the editor, alongside its implementation. */
export function rebaseGesture(
    gesture: Extract<Gesture, { kind: 'editingFrame' }>,
    { entities }: RemoteChanges,
    frameChange: (id: string) => ViewChange<Frame> | null | undefined,
    rebaseFields: (base: object, previous: object, next: object, keys: Iterable<string>) => void
) {
    const draggedFrames = new Set([gesture.frameId, ...Object.keys(gesture.childFrames)]);
    const draggedShapes = new Set(Object.keys(gesture.shapes));
    const membershipChanged =
        Object.entries(entities.frames ?? {}).some(
            ([id, change]) =>
                (draggedFrames.has(id) ||
                    (change !== null && draggedFrames.has(change.view.parentFrameId ?? ''))) &&
                (change === null ||
                    change.changed.some((key) => key === 'parentFrameId' || key === 'locked'))
        ) ||
        Object.entries(entities.shapes ?? {}).some(
            ([id, change]) =>
                (draggedShapes.has(id) ||
                    (change !== null && draggedFrames.has(change.view.parentFrameId ?? ''))) &&
                (change === null ||
                    change.changed.some((key) => key === 'parentFrameId' || key === 'locked'))
        );

    const containersChanged = [entities.groups, entities.layers, entities.components].some(
        (table) =>
            Object.values(table).some(
                (change) =>
                    change !== null &&
                    change.changed.some((key) => key === 'locked' || key === 'shapesIds') &&
                    change.view.shapesIds.some((id) => draggedShapes.has(id))
            )
    );

    if (membershipChanged || containersChanged) {
        // Cancel on the next local pointer event, outside the remote-apply guard.
        // Its restored geometry must be shared back like any other canceled drag.
        gesture.invalidated = true;
    }

    Object.entries(gesture.childFrames).forEach(([id, original]) => {
        const change = frameChange(id);

        if (change === null) {
            delete gesture.childFrames[id];

            return;
        }

        if (change?.previous) {
            rebaseFields(original, change.previous, change.view, change.changed);
        }
    });
    const change = frameChange(gesture.frameId);

    if (change?.previous) {
        rebaseFields(gesture.originalFrame, change.previous, change.view, change.changed);
    }
}
