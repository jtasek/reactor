import { json } from 'overmind';
import { registerTool } from 'src/app/actions/startup';
import { RectTool } from 'src/tools/components/Rect';
import { componentScreenView, pointerDocument } from 'src/app/screenViewEditing';
import { selectionOverlay } from 'src/app/selectionOverlays';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

registerTool(RectTool);

function setup(store = createTestStore().store) {
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
    for (const x of [120, 180, 260]) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x, y: 110 },
            size: { width: 40, height: 40 },
            parentFrameId: screenId
        });
    }
    const [firstId, secondId, outsideId] = store.state.currentDocument.shapesIds;
    store.actions.addComponent({ id: 'card', name: 'Card', shapesIds: [firstId, secondId] });
    store.actions.selectComponentSource('card');
    store.actions.events.setScreenView(viewId);

    return { store, screenId, viewId, mobileId, firstId, secondId, outsideId };
}

it('focuses placed children at their viewport coordinates and excludes other artwork from hit tests', () => {
    const { store, viewId, firstId, secondId, outsideId } = setup();
    const before = serializePersistedState(store.state);
    store.actions.selectComponentChild({ componentId: 'card', shapeId: firstId });
    expect(componentScreenView(store.state)).toMatchObject({ viewId });
    const placed = pointerDocument(store.state);
    expect(placed.shapesIds).toEqual([firstId, secondId]);
    expect(placed.shapes[outsideId]).toBeUndefined();
    expect(placed.shapes[firstId]).toMatchObject({ position: { x: 520, y: 330 } });
    expect(selectionOverlay(store.state)?.extent.topLeft).toEqual({ x: 520, y: 330 });
    expect(serializePersistedState(store.state)).toEqual(before);
});

it('moves and resizes focused children through either view while preserving authored membership', () => {
    const { store, viewId, mobileId, firstId, screenId } = setup();
    store.actions.selectComponentChild({ componentId: 'card', shapeId: firstId });
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 530, y: 340 },
            screenViewId: viewId
        })
    ).toBe(true);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 550, y: 350 }, free: true });
    expect(store.state.currentDocument.shapes[firstId]).toMatchObject({
        position: { x: 140, y: 120 },
        parentFrameId: screenId
    });
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 180, y: 160 },
            screenViewId: mobileId,
            handle: { shapeId: firstId, type: 'bottomRight' }
        })
    ).toBe(true);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 200, y: 180 }, free: true });
    expect(store.state.currentDocument.shapes[firstId]).toMatchObject({
        size: { width: 60, height: 60 }
    });
    expect(store.state.enteredComponentId).toBe('card');
});

it('draws into the focused component through the view instead of creating an unparented master child', () => {
    const { store, viewId, firstId, screenId } = setup();
    store.actions.selectComponentChild({ componentId: 'card', shapeId: firstId });
    store.actions.tools.activateTool('rectangle');
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 650, y: 430 },
            screenViewId: viewId
        })
    ).toBe(true);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 690, y: 470 } });
    const document = store.state.currentDocument;
    const drawnId = document.shapesIds.at(-1)!;
    expect(document.shapes[drawnId]).toMatchObject({
        position: { x: 250, y: 210 },
        size: { width: 40, height: 40 },
        parentFrameId: screenId
    });
    expect(document.components.card.shapesIds).toContain(drawnId);
    expect(store.state.enteredComponentId).toBe('card');
    expect(componentScreenView(store.state)?.viewId).toBe(viewId);
    store.actions.leaveComponentSource();
    expect(document.selectedComponentsIds).toEqual(['card']);
});

it('restores the original component selection, view and camera on exit', () => {
    const { store, viewId, mobileId, firstId, secondId } = setup();
    const document = store.state.currentDocument;
    const camera = json(document.camera);
    store.actions.selectComponentChild({ componentId: 'card', shapeId: firstId });
    store.actions.events.setScreenView(mobileId);
    store.actions.selectComponentChild({ componentId: 'card', shapeId: secondId });
    store.actions.tools.panCamera({ dx: 50, dy: 60 });
    store.actions.leaveComponentSource();
    expect(document.selectedShapesIds).toEqual([firstId, secondId]);
    expect(document.camera).toEqual(camera);
    expect(store.state.events.pointer.screenView?.viewId).toBe(viewId);
    expect(store.state.enteredComponentId).toBeNull();
    expect(store.state.componentEditingReturn).toBeNull();
});

it('edits a source-only master at its instance placement and restores the instance view on return', () => {
    const { store, screenId, viewId } = setup();
    store.actions.unselectShapes();
    store.actions.drawShape({
        type: 'rectangle',
        position: { x: 140, y: 200 },
        size: { width: 40, height: 40 },
        parentFrameId: screenId
    });
    store.actions.createComponentFromSelection();
    const document = store.state.currentDocument;
    const instanceId = document.selectedShapesIds[0];
    const instance = document.shapes[instanceId];
    if (instance.type !== 'instance') {
        throw new Error('Expected an instance');
    }
    store.actions.events.setScreenView(viewId);
    store.actions.selectComponentSource(instance.componentId);
    expect(store.state.events.pointer.screenView?.viewId).toBe(viewId);
    expect(componentScreenView(store.state)?.viewId).toBe(viewId);
    const childId = document.components[instance.componentId].shapesIds[0];
    store.actions.selectComponentChild({ componentId: instance.componentId, shapeId: childId });
    expect(pointerDocument(store.state).shapes[childId]).toMatchObject({
        position: { x: 540, y: 420 }
    });
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 580, y: 460 },
            screenViewId: viewId,
            handle: { shapeId: childId, type: 'bottomRight' }
        })
    ).toBe(true);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 600, y: 480 }, free: true });
    expect(document.shapes[childId]).toMatchObject({
        position: { x: 140, y: 200 },
        size: { width: 60, height: 60 }
    });
    expect(document.shapes[childId].parentFrameId).toBeUndefined();
    store.actions.tools.activateTool('rectangle');
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 700, y: 430 },
            screenViewId: viewId
        })
    ).toBe(true);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 740, y: 470 } });
    const drawnId = document.shapesIds.at(-1)!;
    expect(document.components[instance.componentId].shapesIds).toContain(drawnId);
    expect(document.shapes[drawnId]).toMatchObject({
        position: { x: 300, y: 210 },
        size: { width: 40, height: 40 }
    });
    expect(document.shapes[drawnId].parentFrameId).toBeUndefined();
    store.actions.leaveComponentSource();
    expect(document.selectedShapesIds).toEqual([instanceId]);
    expect(store.state.events.pointer.screenView?.viewId).toBe(viewId);
});

it('opens rotated instances in place and preserves their return view', () => {
    const { store, screenId, viewId } = setup();
    store.actions.unselectShapes();
    store.actions.drawShape({
        type: 'rectangle',
        position: { x: 140, y: 200 },
        size: { width: 40, height: 40 },
        parentFrameId: screenId
    });
    store.actions.createComponentFromSelection();
    const instanceId = store.state.currentDocument.selectedShapesIds[0];
    const instance = store.state.currentDocument.shapes[instanceId];
    if (instance.type !== 'instance') {
        throw new Error('Expected an instance');
    }
    store.actions.setShapesProperty({ shapeIds: [instanceId], key: 'rotation', value: 90 });
    store.actions.events.setScreenView(viewId);
    store.actions.selectComponentSource(instance.componentId);
    expect(componentScreenView(store.state)?.viewId).toBe(viewId);
    expect(store.state.events.pointer.screenView?.viewId).toBe(viewId);
    store.actions.leaveComponentSource();
    expect(store.state.events.pointer.screenView?.viewId).toBe(viewId);
    expect(store.state.currentDocument.selectedShapesIds).toEqual([instanceId]);
});

it('does not start a gesture outside the placed focus and safely exits after its view is deleted', () => {
    const { store, viewId, firstId } = setup();
    store.actions.selectComponentChild({ componentId: 'card', shapeId: firstId });
    expect(store.actions.events.beginGesture({ pointerId: 1, position: { x: 800, y: 100 } })).toBe(
        false
    );
    store.actions.applyRemoteChanges({
        documentId: store.state.currentDocumentId,
        entities: {
            frames: { [viewId]: null },
            shapes: {},
            groups: {},
            components: {},
            layers: {},
            links: {},
            guides: {},
            variables: {},
            dimensions: {}
        }
    });
    store.actions.leaveComponentSource();
    expect(store.state.events.pointer.screenView).toBeNull();
    expect(store.state.enteredComponentId).toBeNull();
});

it('shares and undoes an in-place master edit, keeping remote fields on cancellation', async () => {
    const copies = await createCopies(2, (store) => {
        const { screenId } = setup(store);
        store.actions.unselectShapes();
        store.actions.drawShape({
            type: 'rectangle',
            position: { x: 140, y: 200 },
            size: { width: 40, height: 40 },
            parentFrameId: screenId
        });
        store.actions.createComponentFromSelection();
    });
    const [a, b] = copies;
    const document = shownDocument(a);
    const instance = Object.values(document.shapes).find((shape) => shape.type === 'instance');
    if (instance?.type !== 'instance') {
        throw new Error('Expected an instance');
    }
    const childId = document.components[instance.componentId].shapesIds[0];
    const viewId = Object.values(document.frames).find(
        (frame) => frame.kind === 'view' && frame.position.x === 500
    )!.id;
    a.store.actions.selectComponentSource(instance.componentId);
    a.store.actions.selectComponentChild({ componentId: instance.componentId, shapeId: childId });
    const begin = () =>
        a.store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 580, y: 460 },
            screenViewId: viewId,
            handle: { shapeId: childId, type: 'bottomRight' }
        });
    expect(begin()).toBe(true);
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 600, y: 480 }, free: true });
    edit(b, (actions) =>
        actions.setShapesProperty({ shapeIds: [childId], key: 'name', value: 'Remote child' })
    );
    settle(copies);
    a.store.actions.events.cancelGesture();
    settle(copies);
    expect(shownDocument(a).shapes[childId]).toMatchObject({
        name: 'Remote child',
        size: { width: 40, height: 40 }
    });
    expect(begin()).toBe(true);
    a.store.actions.events.endGesture({ pointerId: 1, position: { x: 600, y: 480 }, free: true });
    settle(copies);
    expect(shownDocument(b).shapes[childId]).toMatchObject({ size: { width: 60, height: 60 } });
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).shapes[childId]).toMatchObject({
        name: 'Remote child',
        size: { width: 40, height: 40 }
    });
});
