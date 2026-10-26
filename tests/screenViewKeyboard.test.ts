import { registerCommand } from 'src/app/actions/startup';
import { CloneCommand } from 'src/commands/clone';
import { MoveRightCommand } from 'src/commands/move';
import { pointerDocument } from 'src/app/screenViewEditing';
import { hasLayoutOffset } from 'src/app/frameLayout';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { createComponent, createShape } from 'src/app/factories';
import { writeClipboard } from 'src/app/clipboard';
import { createTestStore } from './support/store';
import { createCopies, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

registerCommand(CloneCommand);
registerCommand(MoveRightCommand);

function setup(store = createTestStore().store) {
    const screenId = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 80 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'screen' } });
    const viewId = store.actions.editFrame({
        kind: 'addView',
        screenId,
        position: { x: 500, y: 300 },
        size: { width: 500, height: 250 }
    })!;
    store.actions.drawShape({
        type: 'rectangle',
        position: { x: 140, y: 120 },
        size: { width: 40, height: 40 },
        parentFrameId: screenId
    });
    const shapeId = store.state.currentDocument.selectedShapesIds[0];
    store.actions.events.setScreenView(viewId);

    return { store, screenId, viewId, shapeId };
}

function focus(store: ReturnType<typeof createTestStore>['store'], viewId: string) {
    store.actions.createComponentFromSelection();
    const document = store.state.currentDocument;
    const instanceId = document.selectedShapesIds[0];
    const instance = document.shapes[instanceId];

    if (instance.type !== 'instance') {
        throw new Error('Expected an instance');
    }

    store.actions.events.setScreenView(viewId);
    store.actions.selectComponentSource(instance.componentId);
    const childId = document.components[instance.componentId].shapesIds[0];
    store.actions.selectComponentChild({ componentId: instance.componentId, shapeId: childId });

    return { instanceId, componentId: instance.componentId, childId };
}

it('pastes artwork at the last press in the active view and assigns shared screen membership', () => {
    const { store, screenId, viewId } = setup();
    const text = store.actions.copySelection()!;
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 700, y: 440 },
        screenViewId: viewId
    });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 700, y: 440 } });
    expect(store.actions.pasteShapes(text)).toBe('pasted');
    const document = store.state.currentDocument;
    const pastedId = document.selectedShapesIds[0];
    expect(document.shapes[pastedId]).toMatchObject({
        position: { x: 280, y: 200 },
        size: { width: 40, height: 40 },
        parentFrameId: screenId
    });
    expect(pointerDocument(store.state).shapes[pastedId]).toMatchObject({
        position: { x: 680, y: 420 }
    });
});

it('uses the active view center when the last press belongs to another view or the canvas', () => {
    const { store, screenId, viewId } = setup();
    const text = store.actions.copySelection()!;
    store.actions.events.beginGesture({ pointerId: 1, position: { x: 20, y: 20 } });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 20, y: 20 } });
    store.actions.events.setScreenView(viewId);
    expect(store.actions.pasteShapes(text)).toBe('pasted');
    const document = store.state.currentDocument;
    expect(document.shapes[document.selectedShapesIds[0]]).toMatchObject({
        position: { x: 330, y: 185 },
        parentFrameId: screenId
    });
});

it('keeps duplicate children in their focused source, with their view and return context', () => {
    const { store, viewId } = setup();
    const { componentId, childId, instanceId } = focus(store, viewId);
    store.actions.runCommand(CloneCommand);
    const document = store.state.currentDocument;
    const cloneId = document.selectedShapesIds[0];
    expect(cloneId).not.toBe(childId);
    expect(document.components[componentId].shapesIds).toEqual([childId, cloneId]);
    expect(store.state.enteredComponentId).toBe(componentId);
    expect(store.state.events.pointer.screenView?.viewId).toBe(viewId);
    expect(pointerDocument(store.state).shapes[cloneId]).toMatchObject({
        position: { x: 550, y: 350 }
    });
    expect(document.shapes[cloneId].parentFrameId).toBeUndefined();
    store.actions.leaveComponentSource();
    expect(document.selectedShapesIds).toEqual([instanceId]);
});

it('pastes into a focused source as one shared undo step, including component membership', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const viewId = Object.values(shownDocument(a).frames).find(
        (frame) => frame.kind === 'view' && frame.position.x === 500
    )!.id;
    const { componentId, childId } = focus(a.store, viewId);
    settle(copies);
    const text = a.store.actions.copySelection()!;
    expect(a.store.actions.pasteShapes(text)).toBe('pasted');
    const document = shownDocument(a);
    const pastedId = document.selectedShapesIds[0];
    expect(document.components[componentId].shapesIds).toEqual([childId, pastedId]);
    expect(document.shapes[pastedId].parentFrameId).toBeUndefined();
    expect(a.store.state.enteredComponentId).toBe(componentId);
    settle(copies);
    expect(shownDocument(b).components[componentId].shapesIds).toContain(pastedId);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).shapes[pastedId]).toBeUndefined();
    expect(shownDocument(b).components[componentId].shapesIds).toEqual([childId]);
    a.collaboration.redo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).components[componentId].shapesIds).toContain(pastedId);
    expect(shownDocument(b).shapes[pastedId]).toBeDefined();
});

it.each(['locked', 'hidden', 'deleted'] as const)(
    'does not paste, duplicate or nudge through a view that has become %s',
    (restriction) => {
        const { store, viewId, shapeId } = setup();
        const text = store.actions.copySelection()!;
        const document = store.state.currentDocument;

        if (restriction === 'deleted') {
            store.actions.editFrame({ kind: 'delete', id: viewId });
        } else {
            store.actions.editFrame({
                kind: 'toggle',
                id: viewId,
                flag: restriction === 'locked' ? 'locked' : 'visible'
            });
        }

        expect(store.actions.pasteShapes(text)).toBe('notNow');
        store.actions.runCommand(CloneCommand);
        store.actions.runCommand(MoveRightCommand);
        expect(document.shapesIds).toEqual([shapeId]);
        expect(document.shapes[shapeId]).toMatchObject({ position: { x: 140, y: 120 } });
    }
);

it('does not nudge a free child when its parent is offset only at the active viewport size', () => {
    const { store, viewId, shapeId, screenId } = setup();
    const childId = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 180 },
        size: { width: 100, height: 100 }
    })!;
    store.actions.editFrame({ kind: 'update', id: childId, changes: { parentFrameId: screenId } });
    store.actions.editFrame({ kind: 'reparentShapes', ids: [shapeId], parentFrameId: childId });
    store.actions.editFrame({
        kind: 'update',
        id: screenId,
        changes: { stack: { direction: 'row', gap: 0, padding: 0, align: 'end' } }
    });
    store.actions.unselectShapes();
    store.actions.selectShape(shapeId);
    store.actions.events.setScreenView(viewId);
    const document = store.state.currentDocument;
    const before = serializePersistedState(store.state);
    expect(hasLayoutOffset(document, [shapeId])).toBe(false);
    expect(store.actions.runCommand(MoveRightCommand)).toBe(true);
    expect(serializePersistedState(store.state)).toEqual(before);
});

it('copies the resolved size and placement in a view rather than the hidden source geometry', () => {
    const { store, screenId } = setup();
    store.actions.editFrame({
        kind: 'update',
        id: screenId,
        changes: { stack: { direction: 'column', gap: 0, padding: 0, align: 'start' } }
    });
    const shapeId = store.state.currentDocument.selectedShapesIds[0];
    store.actions.applyOperations({
        documentId: store.state.currentDocumentId,
        by: { kind: 'person' },
        operations: [
            { op: 'updateShape', shape: shapeId, changes: { sizing: { width: { mode: 'fill' } } } }
        ]
    });
    const copied = JSON.parse(store.actions.copySelection()!);
    expect(copied.shapes[0]).toMatchObject({
        position: { x: 500, y: 300 },
        size: { width: 500, height: 40 }
    });
});

it('refuses recursive component pastes before changing any document records', () => {
    const { store, viewId } = setup();
    store.actions.createComponentFromSelection();
    const text = store.actions.copySelection()!;
    const document = store.state.currentDocument;
    const instance = document.shapes[document.selectedShapesIds[0]];

    if (instance.type !== 'instance') {
        throw new Error('Expected an instance');
    }

    store.actions.events.setScreenView(viewId);
    store.actions.selectComponentSource(instance.componentId);
    const before = serializePersistedState(store.state);
    expect(store.actions.pasteShapes(text)).toEqual({
        problem: 'A component cannot contain an instance of itself.'
    });
    expect(serializePersistedState(store.state)).toEqual(before);
});

it('checks imported component dependencies before pasting into a focused source', () => {
    const { store, viewId } = setup();
    const { componentId } = focus(store, viewId);
    const member = createShape({
        type: 'instance',
        name: 'Nested card',
        componentId,
        position: { x: 0, y: 0 },
        overrides: {},
        order: 'a0'
    });
    const wrapper = createComponent({
        id: 'wrapper',
        name: 'Wrapper',
        library: { documentId: 'library', hash: 'snapshot' },
        shapesIds: [member.id],
        sourceShapes: { [member.id]: member }
    });
    const instance = createShape({
        type: 'instance',
        name: 'Wrapper',
        componentId: wrapper.id,
        position: { x: 0, y: 0 },
        overrides: {},
        order: 'a0'
    });
    const document = store.state.currentDocument;
    const text = writeClipboard(
        [instance],
        [],
        {},
        {
            ...document,
            components: { ...document.components, [wrapper.id]: wrapper }
        }
    );
    const before = serializePersistedState(store.state);
    expect(store.actions.pasteShapes(text)).toEqual({
        problem: 'A component cannot contain an instance of itself.'
    });
    expect(serializePersistedState(store.state)).toEqual(before);
});
