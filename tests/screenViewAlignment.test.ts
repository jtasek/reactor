import { json } from 'overmind';
import { registerCommand } from 'src/app/actions/startup';
import {
    AlignBottomCommand,
    AlignLeftCommand,
    SpaceBetweenHorizontallyCommand,
    SpaceBetweenVerticallyCommand,
    SpaceEquallyHorizontallyCommand,
    SpaceEquallyVerticallyCommand
} from 'src/commands/align';
import { pointerDocument } from 'src/app/screenViewEditing';
import { hasLayoutOffset } from 'src/app/frameLayout';
import { projectScreenViews } from 'src/app/screenProjection';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

[
    AlignBottomCommand,
    AlignLeftCommand,
    SpaceBetweenHorizontallyCommand,
    SpaceBetweenVerticallyCommand,
    SpaceEquallyHorizontallyCommand,
    SpaceEquallyVerticallyCommand
].forEach(registerCommand);

function setup(store = createTestStore().store) {
    const screenId = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 80 },
        size: { width: 400, height: 350 }
    })!;
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'screen' } });
    const mobileId = Object.values(store.state.currentDocument.frames).find(
        (frame) => frame.kind === 'view'
    )!.id;
    const viewId = store.actions.editFrame({
        kind: 'addView',
        screenId,
        position: { x: 600, y: 500 },
        size: { width: 600, height: 450 }
    })!;
    for (const [x, y, width, height] of [
        [120, 110, 20, 20],
        [200, 170, 60, 40],
        [420, 310, 40, 60]
    ]) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x, y },
            size: { width, height },
            parentFrameId: screenId
        });
    }
    const ids = [...store.state.currentDocument.shapesIds];
    store.actions.unselectShapes();
    ids.forEach((id) => store.actions.selectShape(id));
    store.actions.events.setScreenView(viewId);

    return { store, screenId, viewId, mobileId, ids };
}

it('shares one cached set of placed boxes between controls and command execution', () => {
    const { store, viewId, mobileId, ids } = setup();
    const before = serializePersistedState(store.state);
    const items = store.state.alignmentItems;
    expect(items.map(({ box }) => box.topLeft)).toEqual([
        { x: 620, y: 530 },
        { x: 700, y: 590 },
        { x: 920, y: 730 }
    ]);
    expect(store.state.alignmentItems).toBe(items);
    expect(serializePersistedState(store.state)).toEqual(before);
    expect(store.actions.runCommand(AlignLeftCommand)).toBe(true);
    expect(ids.map((id) => store.state.currentDocument.shapes[id])).toMatchObject([
        { position: { x: 120, y: 110 } },
        { position: { x: 120, y: 170 } },
        { position: { x: 120, y: 310 } }
    ]);
    expect(store.state.events.pointer.screenView?.viewId).toBe(viewId);
    store.actions.events.setScreenView(mobileId);
    expect(store.state.alignmentItems[0].box.topLeft).toEqual({ x: 120, y: 110 });
    expect(store.state.alignmentItems).not.toBe(items);
    expect(before.documents[store.state.currentDocumentId].frames).toEqual(
        serializePersistedState(store.state).documents[store.state.currentDocumentId].frames
    );
});

it.each([
    [SpaceBetweenHorizontallyCommand, { x: 250, y: 170 }],
    [SpaceEquallyHorizontallyCommand, { x: 255, y: 170 }],
    [SpaceBetweenVerticallyCommand, { x: 200, y: 200 }],
    [SpaceEquallyVerticallyCommand, { x: 200, y: 210 }]
] as const)('keeps the meaning of $0.name in a placed view', (command, position) => {
    const { store, screenId, ids } = setup();
    const first = json(store.state.currentDocument.shapes[ids[0]]);
    const last = json(store.state.currentDocument.shapes[ids[2]]);
    expect(store.actions.runCommand(command)).toBe(true);
    const document = store.state.currentDocument;
    expect(document.shapes[ids[1]]).toMatchObject({ position, parentFrameId: screenId });
    expect(document.shapes[ids[0]]).toEqual(first);
    expect(document.shapes[ids[2]]).toEqual(last);
});

it('moves a whole group including hidden members by its visible bounds and a rotated target', () => {
    const { store, screenId, ids } = setup();
    store.actions.unselectShapes();
    store.actions.selectShape(ids[0]);
    store.actions.selectShape(ids[1]);
    store.actions.groupSelection();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 160, y: 140 },
        size: { width: 10, height: 10 },
        visible: false,
        parentFrameId: screenId
    });
    const document = store.state.currentDocument;
    const hiddenId = document.shapesIds.at(-1)!;
    // Add the hidden member through the same component-independent grouping action.
    const groupId = document.groupsIds[0];
    store.actions.addShapesToGroup({ groupId, shapeIds: [hiddenId] });
    store.actions.setShapesProperty({ shapeIds: [ids[2]], key: 'rotation', value: 90 });
    store.actions.selectShape(ids[2]);
    expect(store.state.alignmentItems).toHaveLength(2);
    expect(store.actions.runCommand(AlignBottomCommand)).toBe(true);
    expect(document.shapes[ids[0]]).toMatchObject({ position: { x: 120, y: 260 } });
    expect(document.shapes[ids[1]]).toMatchObject({ position: { x: 200, y: 320 } });
    expect(document.shapes[hiddenId]).toMatchObject({ position: { x: 160, y: 290 } });
});

it('treats a selected local component container as one item in a Screen view', () => {
    const { store, ids } = setup();
    store.actions.addComponent({ id: 'card', name: 'Card', shapesIds: ids.slice(0, 2) });
    expect(store.state.alignmentItems).toHaveLength(2);
    expect(store.actions.runCommand(AlignLeftCommand)).toBe(true);
    expect(store.state.currentDocument.shapes[ids[1]]).toMatchObject({
        position: { x: 200, y: 170 }
    });
    expect(store.state.currentDocument.shapes[ids[2]]).toMatchObject({
        position: { x: 120, y: 310 }
    });
    expect(SpaceBetweenHorizontallyCommand.canExecute({ state: store.state })).toBe(false);
});

it.each(['locked', 'hidden', 'deleted'] as const)(
    'disables controls and direct actions when the active view becomes %s',
    (restriction) => {
        const { store, viewId } = setup();
        expect(store.state.alignmentItems).toHaveLength(3);
        if (restriction === 'deleted') {
            store.actions.editFrame({ kind: 'delete', id: viewId });
        } else {
            store.actions.editFrame({
                kind: 'toggle',
                id: viewId,
                flag: restriction === 'locked' ? 'locked' : 'visible'
            });
        }
        const before = serializePersistedState(store.state);
        expect(AlignLeftCommand.canExecute({ state: store.state })).toBe(false);
        expect(store.state.alignmentItems).toEqual([]);
        store.actions.alignSelection('left');
        store.actions.spaceSelection({ axis: 'horizontal', spacing: 'between' });
        expect(serializePersistedState(store.state)).toEqual(before);
    }
);

it('rejects mixed canvas/view selections without partially moving either part', () => {
    const { store } = setup();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 20, height: 20 },
        selected: true
    });
    const before = serializePersistedState(store.state);
    expect(store.state.alignmentItems).toEqual([]);
    expect(store.actions.runCommand(AlignLeftCommand)).toBe(false);
    store.actions.alignSelection('left');
    expect(serializePersistedState(store.state)).toEqual(before);
});

it('excludes an item moved by layout only at the active viewport size', () => {
    const { store, screenId, viewId, ids } = setup();
    const childId = store.actions.editFrame({
        kind: 'add',
        position: { x: 200, y: 330 },
        size: { width: 100, height: 100 }
    })!;
    store.actions.editFrame({ kind: 'update', id: childId, changes: { parentFrameId: screenId } });
    store.actions.editFrame({ kind: 'reparentShapes', ids: [ids[0]], parentFrameId: childId });
    store.actions.editFrame({
        kind: 'update',
        id: screenId,
        changes: { stack: { direction: 'row', gap: 0, padding: 0, align: 'end' } }
    });
    store.actions.unselectShapes();
    ids.forEach((id) => store.actions.selectShape(id));
    store.actions.events.setScreenView(viewId);
    const document = store.state.currentDocument;
    expect(hasLayoutOffset(document, [ids[0]])).toBe(false);
    expect(store.state.alignmentItems.some(({ shapeIds }) => shapeIds.includes(ids[0]))).toBe(
        false
    );
    const before = serializePersistedState(store.state);
    store.actions.alignSelection('left');
    expect(serializePersistedState(store.state)).toEqual(before);
});

it('also checks hidden component members against viewport-only layout offsets', () => {
    const { store, screenId, viewId, ids } = setup();
    const visibleFrame = store.actions.editFrame({
        kind: 'add',
        position: { x: 200, y: 80 },
        size: { width: 100, height: 350 }
    })!;
    store.actions.editFrame({
        kind: 'update',
        id: visibleFrame,
        changes: { parentFrameId: screenId, sizing: { height: { mode: 'fill' } } }
    });
    store.actions.editFrame({ kind: 'reparentShapes', ids: [ids[0]], parentFrameId: visibleFrame });
    const hiddenFrame = store.actions.editFrame({
        kind: 'add',
        position: { x: 300, y: 330 },
        size: { width: 100, height: 100 }
    })!;
    store.actions.editFrame({
        kind: 'update',
        id: hiddenFrame,
        changes: { parentFrameId: screenId }
    });
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 320, y: 350 },
        size: { width: 20, height: 20 },
        visible: false,
        parentFrameId: hiddenFrame
    });
    const document = store.state.currentDocument;
    const hiddenId = document.shapesIds.at(-1)!;
    store.actions.addComponent({ id: 'card', shapesIds: [ids[0], hiddenId] });
    store.actions.editFrame({
        kind: 'update',
        id: screenId,
        changes: { stack: { direction: 'row', gap: 0, padding: 0, align: 'end' } }
    });
    store.actions.unselectShapes();
    store.actions.selectShape(ids[0]);
    store.actions.events.setScreenView(viewId);
    expect(hasLayoutOffset(document, [ids[0], hiddenId])).toBe(false);
    const projection = projectScreenViews(document).find(
        ({ view }) => view.id === viewId
    )!.projection!;
    expect(projection.layoutOffsets.has(ids[0])).toBe(false);
    expect(projection.layoutOffsets.has(hiddenId)).toBe(true);
    expect(store.state.alignmentItems).toEqual([]);
});

it('aligns focused master children without changing their placement or return context', () => {
    const { store, viewId, ids } = setup();
    store.actions.createComponentFromSelection();
    const document = store.state.currentDocument;
    const instanceId = document.selectedShapesIds[0];
    const instance = document.shapes[instanceId];
    if (instance.type !== 'instance') {
        throw new Error('Expected an instance');
    }
    store.actions.events.setScreenView(viewId);
    store.actions.selectComponentSource(instance.componentId);
    ids.forEach((id) => store.actions.selectShape(id));
    expect(store.state.alignmentItems).toHaveLength(3);
    expect(store.actions.runCommand(SpaceEquallyHorizontallyCommand)).toBe(true);
    expect(document.shapes[ids[1]]).toMatchObject({ position: { x: 255, y: 170 } });
    expect(document.shapes[ids[1]].parentFrameId).toBeUndefined();
    expect(pointerDocument(store.state).shapes[ids[1]]).toMatchObject({
        position: { x: 755, y: 590 }
    });
    expect(store.state.enteredComponentId).toBe(instance.componentId);
    store.actions.leaveComponentSource();
    expect(document.selectedShapesIds).toEqual([instanceId]);
    expect(store.state.events.pointer.screenView?.viewId).toBe(viewId);
});

it('shares alignment and undoes it without reverting a remote author’s edit', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const document = shownDocument(a);
    const ids = [...document.shapesIds];
    expect(a.store.actions.runCommand(AlignLeftCommand)).toBe(true);
    settle(copies);
    expect(shownDocument(b).shapes[ids[2]]).toMatchObject({ position: { x: 120, y: 310 } });
    edit(b, (actions) =>
        actions.setShapesProperty({ shapeIds: [ids[2]], key: 'name', value: 'Remote name' })
    );
    settle(copies);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).shapes[ids[2]]).toMatchObject({
        position: { x: 420, y: 310 },
        name: 'Remote name'
    });
});

it('treats a selected local component as one item on the Canvas too', () => {
    const { store } = createTestStore();
    for (const [x, y, width, height] of [
        [120, 110, 20, 20],
        [200, 170, 60, 40],
        [420, 310, 40, 60]
    ]) {
        store.actions.addShape({ type: 'rectangle', position: { x, y }, size: { width, height } });
    }
    const ids = [...store.state.currentDocument.shapesIds];
    store.actions.unselectShapes();
    ids.forEach((id) => store.actions.selectShape(id));
    store.actions.addComponent({ id: 'card', name: 'Card', shapesIds: ids.slice(0, 2) });
    expect(store.state.alignmentItems).toHaveLength(2);
    expect(SpaceBetweenHorizontallyCommand.canExecute({ state: store.state })).toBe(false);
    expect(store.actions.runCommand(AlignLeftCommand)).toBe(true);
    expect(ids.map((id) => store.state.currentDocument.shapes[id])).toMatchObject([
        { position: { x: 120, y: 110 } },
        { position: { x: 200, y: 170 } },
        { position: { x: 120, y: 310 } }
    ]);

    // A locked member keeps the whole component in place.
    store.actions.setShapesProperty({ shapeIds: [ids[1]], key: 'locked', value: true });
    expect(store.state.alignmentItems.map(({ shapeIds }) => shapeIds)).toEqual([[ids[2]]]);
});
