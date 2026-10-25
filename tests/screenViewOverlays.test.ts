import { json } from 'overmind';
import {
    selectionMenuPlacement,
    selectionOverlay,
    measuredBoxes,
    snappedBox
} from 'src/app/selectionOverlays';
import { measuresBetween } from 'src/app/measures';
import { createTestStore } from './support/store';
import { serializePersistedState } from 'src/app/services/documentStorage';

function setup() {
    const { store } = createTestStore();
    const screenId = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 80 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'screen' } });
    const mobileId = Object.values(store.state.currentDocument.frames).find(
        (frame) => frame.kind === 'view'
    )!.id;
    const viewId = store.actions.editFrame({
        kind: 'addView',
        screenId,
        position: { x: 500, y: 300 },
        size: { width: 500, height: 250 }
    })!;
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 120, y: 110 },
        size: { width: 80, height: 60 },
        parentFrameId: screenId
    });
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 260, y: 110 },
        size: { width: 40, height: 60 },
        parentFrameId: screenId
    });
    const [shapeId, targetId] = store.state.currentDocument.shapesIds;
    store.actions.unselectShapes();
    store.actions.selectShape(shapeId);
    store.actions.events.setScreenView(viewId);
    store.actions.events.movePointer({
        pointerId: 1,
        position: { x: 550, y: 350 },
        screenViewId: viewId
    });

    return { store, screenId, mobileId, viewId, shapeId, targetId };
}

it('anchors the selection menu in the active viewport without changing durable geometry', () => {
    const { store, viewId, mobileId } = setup();
    const before = serializePersistedState(store.state);
    expect(selectionOverlay(store.state)?.extent).toMatchObject({
        topLeft: { x: 520, y: 330 },
        width: 80,
        height: 60
    });
    expect(selectionMenuPlacement(store.state, false)).toMatchObject({
        left: 520,
        bottom: 292,
        shown: true
    });
    store.actions.events.setScreenView(mobileId);
    expect(selectionMenuPlacement(store.state, false)).toMatchObject({
        left: 120,
        bottom: 72,
        shown: false
    });
    store.actions.events.setScreenView(viewId);
    expect(serializePersistedState(store.state)).toEqual(before);
    store.actions.editFrame({
        kind: 'update',
        id: viewId,
        changes: { position: { x: 600, y: 400 } }
    });
    expect(selectionOverlay(store.state)?.extent.topLeft).toEqual({ x: 620, y: 430 });
    store.actions.editFrame({
        kind: 'update',
        id: viewId,
        changes: { position: { x: 500, y: 300 } }
    });
});

it('measures only targets in the active view with Alt held', () => {
    const { store, viewId, mobileId } = setup();
    store.actions.events.keyDown({ altKey: true } as KeyboardEvent);
    store.actions.events.movePointer({
        pointerId: 1,
        position: { x: 680, y: 350 },
        screenViewId: viewId
    });
    const boxes = measuredBoxes(store.state)!;
    expect(measuresBetween(boxes.selection, boxes.target)).toEqual([
        { axis: 'x', from: { x: 600, y: 360 }, to: { x: 660, y: 360 } }
    ]);
    store.actions.events.movePointer({
        pointerId: 1,
        position: { x: 280, y: 130 },
        screenViewId: mobileId
    });
    expect(measuredBoxes(store.state)).toBeNull();
    store.actions.events.setScreenView(mobileId);
    expect(measuredBoxes(store.state)?.selection.topLeft).toEqual({ x: 120, y: 110 });
    store.actions.events.releaseModifiers();
    expect(measuredBoxes(store.state)).toBeNull();
});

it('uses layout resolved at the selected viewport and rotated target bounds', () => {
    const { store, screenId } = setup();
    store.actions.editFrame({
        kind: 'update',
        id: screenId,
        changes: { stack: { direction: 'column', gap: 30, padding: 10, align: 'end' } }
    });
    expect(selectionOverlay(store.state)?.extent.topLeft).toEqual({ x: 910, y: 310 });
});

it('measures rotated target bounds in the displayed view', () => {
    const { store, viewId, targetId } = setup();
    store.actions.setShapesProperty({ shapeIds: [targetId], key: 'rotation', value: 90 });
    store.actions.events.keyDown({ altKey: true } as KeyboardEvent);
    store.actions.events.movePointer({
        pointerId: 1,
        position: { x: 680, y: 350 },
        screenViewId: viewId
    });
    expect(measuredBoxes(store.state)?.target.width).toBeCloseTo(60);
    expect(measuredBoxes(store.state)?.target.height).toBeCloseTo(40);
});

it.each(['hidden', 'locked', 'deleted'] as const)(
    'does not show ghost overlays after the view is %s',
    (change) => {
        const { store, viewId } = setup();
        if (change === 'deleted') {
            store.actions.editFrame({ kind: 'delete', id: viewId });
        }
        if (change === 'hidden' || change === 'locked') {
            store.actions.editFrame({
                kind: 'toggle',
                id: viewId,
                flag: change === 'hidden' ? 'visible' : 'locked'
            });
        }
        expect(selectionOverlay(store.state)).toBeNull();
        expect(selectionMenuPlacement(store.state, true)).toBeNull();
    }
);

it('suppresses overlays for selections spanning contexts and keeps ordinary canvas placement', () => {
    const { store, shapeId } = setup();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 800, y: 100 },
        size: { width: 100, height: 100 }
    });
    const looseId = store.state.currentDocument.shapesIds[2];
    store.actions.selectShape(looseId);
    expect(selectionOverlay(store.state)).toBeNull();
    store.actions.unselectShape(shapeId);
    expect(selectionOverlay(store.state)?.extent.topLeft).toEqual({ x: 800, y: 100 });
    store.actions.events.setScreenView(null);
    store.actions.events.keyDown({ altKey: true } as KeyboardEvent);
    store.actions.events.movePointer({ pointerId: 1, position: { x: 130, y: 120 } });
    expect(measuredBoxes(store.state)).toBeNull();
});

it('keeps resize snap overlays in placed coordinates and hides menus during a gesture', () => {
    const { store, viewId, shapeId } = setup();
    const original = json(store.state.currentDocument.shapes[shapeId]);
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 600, y: 390 },
        screenViewId: viewId,
        handle: { shapeId, type: 'bottomRight' }
    });
    store.actions.events.movePointer({ pointerId: 1, position: { x: 656, y: 390 } });
    expect(selectionMenuPlacement(store.state, false)).toBeNull();
    expect(snappedBox(store.state)).toMatchObject({
        topLeft: { x: 520, y: 330 },
        bottomRight: { x: 660, y: 390 }
    });
    store.actions.events.cancelGesture();
    expect(json(store.state.currentDocument.shapes[shapeId])).toEqual(original);
    expect(snappedBox(store.state)).toBeNull();
});

it('places the menu through the camera while keeping measurement geometry in canvas units', () => {
    const { store } = setup();
    store.actions.tools.zoomToAnchor({ scale: 2, anchor: { x: 0, y: 0 }, point: { x: 30, y: 40 } });
    expect(selectionMenuPlacement(store.state, false)).toMatchObject({
        left: 1070,
        bottom: 662,
        shown: true
    });
    expect(selectionOverlay(store.state)?.extent.topLeft).toEqual({ x: 520, y: 330 });
});
