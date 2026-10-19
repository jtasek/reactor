import { json } from 'overmind';
import type { Context } from './index';
import type { Frame, Point, ResizeHandlerType } from './types';
import type { RestoredEntity } from './services/collaboration';
import { readEntity, orUndefined, MIN_FRAME_SIZE } from './services/documentStorage';
import { isReadOnly } from './documentAccess';
import { numberedName } from './factories';
import { resizeBox } from './utils';
import { CLONE_OFFSET } from './geometry';

export type FrameEdit =
    | { kind: 'add'; position: Point; size: Frame['size'] }
    | { kind: 'select'; id: string }
    | { kind: 'update'; id: string; changes: Partial<Pick<Frame, 'name' | 'position' | 'size'>> }
    | { kind: 'delete'; id: string; documentId?: string }
    | { kind: 'clone'; id: string }
    | { kind: 'toggle'; id: string; flag: 'locked' | 'visible' }
    | { kind: 'paste'; frame: Frame; target: Point | null };

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
        operations: [{ op: 'addFrame', key: 'frame', frame }]
    });

    if (!result.applied) {
        return;
    }

    return actions.editFrame({ kind: 'select', id: result.ids.frame });
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

    const frame = document.frames[input.id];

    if (input.kind === 'toggle') {
        if (!frame) {
            return;
        }

        frame[input.flag] = !frame[input.flag];

        if (!frame.visible && document.selectedFrameId === frame.id) {
            delete document.selectedFrameId;
        }

        return frame.id;
    }

    if (!frame || frame.locked) {
        return;
    }

    if (input.kind === 'delete') {
        if (input.documentId && input.documentId !== document.id) {
            return;
        }

        delete document.frames[frame.id];

        if (document.selectedFrameId === frame.id) {
            delete document.selectedFrameId;
        }

        return;
    }

    if (input.kind === 'clone') {
        return actions.editFrame({ kind: 'paste', frame: json(frame), target: null });
    }

    const next = orUndefined(() => readEntity('frames', { ...json(frame), ...input.changes }));

    if (next) {
        Object.assign(frame, next);
    }

    return frame.id;
}

export function begin(
    context: Pick<Context, 'state' | 'actions' | 'effects'>,
    owner: { pointerId: number; touch: boolean; moved: boolean; selectedFrameId?: string },
    handle: { frameId: string; type: ResizeHandlerType | 'move' }
) {
    const { state, actions, effects } = context;
    const frame = state.currentDocument.frames[handle.frameId];

    if (
        !frame ||
        !frame.visible ||
        frame.locked ||
        state.currentDocument.locked ||
        isReadOnly(state)
    ) {
        effects.collaboration.resume();

        return false;
    }

    const selection = Object.fromEntries(
        Object.values(state.currentDocument.shapes).map((shape) => [shape.id, shape.selected])
    );

    actions.editFrame({ kind: 'select', id: frame.id });
    state.events.pointer.gesture = {
        ...owner,
        kind: 'editingFrame',
        selection,
        frameId: frame.id,
        originalFrame: json(frame),
        handle: handle.type
    };

    return true;
}

export function move({ state }: Pick<Context, 'state'>, position: Point) {
    const { gesture, start } = state.events.pointer;

    if (gesture.kind !== 'editingFrame' || !gesture.moved) {
        return;
    }

    const frame = state.currentDocument.frames[gesture.frameId];

    if (!frame || frame.locked || state.currentDocument.locked || isReadOnly(state)) {
        return;
    }

    if (gesture.handle === 'move') {
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

    const frame = state.currentDocument.frames[gesture.frameId];

    if (frame) {
        Object.assign(frame, json(gesture.originalFrame));
        restored.push(['frames', frame.id]);
    }
}

const FORMAT = 'reactor/frame';
export const writeClipboard = (frame: Frame) =>
    JSON.stringify({ format: FORMAT, frame: readEntity('frames', frame) });
export function readClipboard(text: string) {
    return orUndefined(() => {
        const data = JSON.parse(text);

        return data.format === FORMAT ? readEntity('frames', data.frame) : undefined;
    });
}
