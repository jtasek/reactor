import { registerTool } from 'src/app/actions/startup';
import { componentAtPoint } from 'src/app/componentSelection';
import { restoreDocuments, serializePersistedState } from 'src/app/services/documentStorage';
import { SelectTool } from 'src/tools';
import { createTestStore } from './support/store';
import {
    createCopies,
    deliver,
    edit,
    settle,
    shownDocument,
    type Copy
} from './support/collaboration';

registerTool(SelectTool);

function setup() {
    const { store } = createTestStore();
    for (const x of [100, 200]) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x, y: 100 },
            size: { width: 40, height: 40 },
            selected: true
        });
    }
    store.actions.addComponent({ shapesIds: [...store.state.currentDocument.shapesIds] });
    const document = store.state.currentDocument;
    const componentId = document.componentsIds[0];
    const ids = [...document.shapesIds];
    const { events } = store.actions;
    const click = (x: number, y: number) => {
        events.beginGesture({ pointerId: 1, position: { x, y } });
        events.endGesture({ pointerId: 1, position: { x, y } });
    };
    store.actions.unselectShapes();
    return { store, document, componentId, ids, events, click };
}

it('selects and moves every source child when pressing the space between them', () => {
    const { document, componentId, ids, events } = setup();
    events.beginGesture({ pointerId: 1, position: { x: 170, y: 120 } });
    expect(document.selectedComponentsIds).toEqual([componentId]);
    events.endGesture({ pointerId: 1, position: { x: 170, y: 150 } });
    expect(ids.map((id) => document.shapes[id])).toMatchObject([
        { position: { x: 100, y: 130 } },
        { position: { x: 200, y: 130 } }
    ]);
});

it('enters an already selected source to edit one child and leaves on an outside click', () => {
    const { store, document, componentId, ids, click } = setup();
    click(110, 110);
    expect(document.selectedComponentsIds).toEqual([componentId]);
    click(110, 110);
    expect(store.state.enteredComponentId).toBe(componentId);
    expect(document.selectedComponentsIds).toEqual([]);
    expect(document.selectedShapesIds).toEqual([ids[0]]);
    click(400, 400);
    expect(store.state.enteredComponentId).toBeNull();
    click(210, 110);
    expect(document.selectedShapesIds).toEqual(ids);
});

it('selects the whole source when a marquee intersects one child', () => {
    const { store, document, componentId, events } = setup();
    events.setStartPosition({ x: 105, y: 105 });
    events.setCurrentPosition({ x: 110, y: 110 });
    store.actions.selectShapes();
    expect(document.selectedComponentsIds).toEqual([componentId]);
});

it('resizes children proportionally and restores all geometry on cancellation', () => {
    const { store, document, componentId, ids, events } = setup();
    store.actions.selectComponentSource(componentId);
    events.beginGesture({
        pointerId: 1,
        position: { x: 240, y: 140 },
        handle: { componentId, type: 'bottomRight' }
    });
    events.movePointer({ pointerId: 1, position: { x: 380, y: 180 } });
    expect(ids.map((id) => document.shapes[id])).toMatchObject([
        { position: { x: 100, y: 100 }, size: { width: 80, height: 80 } },
        { position: { x: 300, y: 100 }, size: { width: 80, height: 80 } }
    ]);
    events.cancelGesture();
    expect(ids.map((id) => document.shapes[id])).toMatchObject([
        { position: { x: 100, y: 100 }, size: { width: 40, height: 40 } },
        { position: { x: 200, y: 100 }, size: { width: 40, height: 40 } }
    ]);
});

it('rotates one shared frame, restores it on cancel, and persists the committed rotation', () => {
    const { store, document, componentId, ids, events } = setup();
    store.actions.selectComponentSource(componentId);
    const begin = () =>
        events.beginGesture({
            pointerId: 1,
            position: { x: 170, y: 80 },
            handle: { componentId, type: 'rotate' }
        });
    begin();
    events.movePointer({ pointerId: 1, position: { x: 220, y: 120 } });
    expect(document.components[componentId].rotation).toBe(90);
    expect(ids.map((id) => document.shapes[id].rotation)).toEqual([90, 90]);
    expect(componentAtPoint(document, { x: 170, y: 165 }, null)?.id).toBe(componentId);
    expect(componentAtPoint(document, { x: 110, y: 120 }, null)).toBeUndefined();
    events.cancelGesture();
    expect(document.components[componentId].rotation ?? 0).toBe(0);
    expect(ids.map((id) => document.shapes[id].rotation ?? 0)).toEqual([0, 0]);
    begin();
    events.endGesture({ pointerId: 1, position: { x: 220, y: 120 } });
    const restored = restoreDocuments(serializePersistedState(store.state));
    expect(restored[document.id].components[componentId].rotation).toBe(90);
});

it('does not begin transforming a locked source', () => {
    const { store, componentId, events } = setup();
    store.actions.updateComponent({ id: componentId, locked: true });
    expect(
        events.beginGesture({
            pointerId: 1,
            position: { x: 240, y: 140 },
            handle: { componentId, type: 'bottomRight' }
        })
    ).toBe(false);
    expect(store.state.events.pointer.gesture.kind).toBe('idle');
});

it('uses only the component frame when its children also form a group', () => {
    const { store, document, componentId, ids } = setup();
    store.actions.addGroup({ id: 'group', shapesIds: ids });
    store.actions.selectComponentSource(componentId);
    expect(document.selectedComponentsIds).toEqual([componentId]);
    expect(document.selectedGroupsIds).toEqual([]);
    store.actions.selectComponentChild({ componentId, shapeId: ids[0] });
    expect(document.selectedGroupsIds).toEqual([]);
});

it('cancel keeps a component rotation received from another copy', async () => {
    const copies = await createCopies(2, (store) => {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 100, y: 100 },
            size: { width: 40, height: 40 }
        });
        store.actions.addComponent({ shapesIds: [...store.state.currentDocument.shapesIds] });
    });
    const componentId = shownDocument(copies[0]).componentsIds[0];
    const rotation = (copy: Copy) => shownDocument(copy).components[componentId].rotation;
    // Yjs keeps one of two concurrent rotations by its random client ids, so each
    // copy takes the canceled gesture's turn once: one of them wins the merge.
    const rotateWhileTheOtherCancels = (rotating: Copy, canceling: Copy) => {
        const { events } = canceling.store.actions;
        const before = rotation(canceling);

        events.beginGesture({
            pointerId: 1,
            position: { x: 120, y: 80 },
            handle: { componentId, type: 'rotate' }
        });
        events.movePointer({ pointerId: 1, position: { x: 160, y: 120 } });
        edit(rotating, (actions) => {
            actions.events.beginGesture({
                pointerId: 2,
                position: { x: 120, y: 80 },
                handle: { componentId, type: 'rotate' }
            });
            actions.events.endGesture({ pointerId: 2, position: { x: 160, y: 80 } });
        });
        const received = rotation(rotating);

        expect(received).not.toBe(before);
        expect(received).not.toBe(rotation(canceling));
        deliver(canceling);
        events.cancelGesture();
        expect(rotation(canceling)).toBe(received);
        settle(copies);
        expect(copies.map(rotation)).toEqual([received, received]);
    };
    try {
        rotateWhileTheOtherCancels(copies[1], copies[0]);
        rotateWhileTheOtherCancels(copies[0], copies[1]);
    } finally {
        copies.forEach(({ collaboration }) => collaboration.dispose());
    }
});
