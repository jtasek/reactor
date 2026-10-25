import { json } from 'overmind';
import { projectScreenViews } from 'src/app/screenProjection';
import { canTransformScreenViewShape, screenViewTransformTarget } from 'src/app/screenViewEditing';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

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
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 120, y: 110 },
        size: { width: 80, height: 60 },
        parentFrameId: screenId
    });
    store.actions.tools.activateTool('select');
    const shapeId = store.state.currentDocument.shapesIds[0];

    return { store, screenId, viewId, shapeId };
}

it('resizes shared artwork from the placed handle and leaves both viewports intact', () => {
    const { store, viewId, shapeId } = setup();
    const document = store.state.currentDocument;
    const frames = json(document.frames);
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 600, y: 390 },
            screenViewId: viewId,
            handle: { shapeId, type: 'bottomRight' }
        })
    ).toBe(true);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 640, y: 420 }, free: true });
    expect(document.shapes[shapeId]).toMatchObject({
        position: { x: 120, y: 110 },
        size: { width: 120, height: 90 }
    });
    expect(projectScreenViews(document).map((item) => item.projection!.shapes[0])).toEqual([
        expect.objectContaining({ size: { width: 120, height: 90 } }),
        expect.objectContaining({ size: { width: 120, height: 90 } })
    ]);
    expect(json(document.frames)).toEqual(frames);
});

it('rotates around the projected center and restores source geometry on cancel', () => {
    const { store, viewId, shapeId } = setup();
    const document = store.state.currentDocument;
    const original = json(document.shapes[shapeId]);
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 560, y: 306 },
        screenViewId: viewId,
        handle: { shapeId, type: 'rotate' }
    });
    store.actions.events.movePointer({ pointerId: 1, position: { x: 650, y: 360 } });
    expect(document.shapes[shapeId].rotation).toBeCloseTo(90);
    store.actions.events.cancelGesture();
    expect(json(document.shapes[shapeId])).toEqual(original);
});

it.each(['locked', 'outside', 'stack'] as const)(
    'rejects a %s shape handle in a view',
    (restriction) => {
        const { store, viewId, shapeId, screenId } = setup();
        if (restriction === 'stack') {
            store.actions.editFrame({
                kind: 'update',
                id: screenId,
                changes: { stack: { direction: 'row', gap: 0, padding: 0, align: 'start' } }
            });
        }
        if (restriction === 'locked') {
            store.actions.setShapesProperty({ shapeIds: [shapeId], key: 'locked', value: true });
        }
        if (restriction === 'outside') {
            store.actions.editFrame({
                kind: 'reparentShapes',
                ids: [shapeId],
                parentFrameId: null
            });
        }
        expect(
            store.actions.events.beginGesture({
                pointerId: 1,
                position: { x: 600, y: 390 },
                screenViewId: viewId,
                handle: { shapeId, type: 'bottomRight' }
            })
        ).toBe(false);
        expect(store.state.events.pointer.gesture.kind).toBe('idle');
    }
);

it('shares and undoes a resize while preserving a remote edit on cancellation', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const document = shownDocument(a);
    const shapeId = document.shapesIds[0];
    const viewId = Object.values(document.frames).find((frame) => frame.position.x === 500)!.id;
    const begin = () =>
        a.store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 600, y: 390 },
            screenViewId: viewId,
            handle: { shapeId, type: 'bottomRight' }
        });
    begin();
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 640, y: 420 }, free: true });
    edit(b, (actions) =>
        actions.setShapesProperty({ shapeIds: [shapeId], key: 'name', value: 'Remote' })
    );
    settle(copies);
    a.store.actions.events.cancelGesture();
    settle(copies);
    expect(shownDocument(a).shapes[shapeId]).toMatchObject({
        name: 'Remote',
        size: { width: 80, height: 60 }
    });
    begin();
    a.store.actions.events.endGesture({ pointerId: 1, position: { x: 640, y: 420 }, free: true });
    settle(copies);
    expect(shownDocument(b).shapes[shapeId]).toMatchObject({ size: { width: 120, height: 90 } });
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).shapes[shapeId]).toMatchObject({
        name: 'Remote',
        size: { width: 80, height: 60 }
    });
});

it('snaps a projected resize to neighboring artwork in the same view', () => {
    const { store, screenId, viewId, shapeId } = setup();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 260, y: 110 },
        size: { width: 40, height: 60 },
        parentFrameId: screenId
    });
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 600, y: 390 },
        screenViewId: viewId,
        handle: { shapeId, type: 'bottomRight' }
    });
    store.actions.events.movePointer({ pointerId: 1, position: { x: 656, y: 390 } });
    expect(store.state.currentDocument.shapes[shapeId]).toMatchObject({
        size: { width: 140, height: 60 }
    });
    const gesture = store.state.events.pointer.gesture;
    expect(gesture.kind === 'resizing' && gesture.snapLines.x).toBe(660);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 656, y: 390 } });
});

it('cancels a resize if its view moves remotely and keeps the new placement', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const document = shownDocument(a);
    const shapeId = document.shapesIds[0];
    const viewId = Object.values(document.frames).find((frame) => frame.position.x === 500)!.id;
    const original = json(document.shapes[shapeId]);
    a.store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 600, y: 390 },
        screenViewId: viewId,
        handle: { shapeId, type: 'bottomRight' }
    });
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 640, y: 420 }, free: true });
    edit(b, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: viewId,
            changes: { position: { x: 550, y: 300 } }
        })
    );
    settle(copies);
    a.store.actions.events.endGesture({ pointerId: 1, position: { x: 640, y: 420 }, free: true });
    expect(json(shownDocument(a).shapes[shapeId])).toEqual(original);
    expect(shownDocument(a).frames[viewId].position.x).toBe(550);
    expect(a.store.state.events.pointer.gesture.kind).toBe('idle');
});

it('rejects handles when only the placed viewport offsets a nested free shape', () => {
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
    const projected = projectScreenViews(store.state.currentDocument).find(
        (item) => item.view.id === viewId
    )!.projection!.shapes[0];
    expect(projected.type === 'rectangle' && projected.position.y).toBe(380);
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 600, y: 440 },
            screenViewId: viewId,
            handle: { shapeId, type: 'bottomRight' }
        })
    ).toBe(false);
    expect(store.state.events.pointer.gesture.kind).toBe('idle');
});

it('cancels a resize when a remote layout starts offsetting artwork only in its view', async () => {
    const copies = await createCopies(2, (store) => {
        const { screenId, shapeId } = setup(store);
        const childId = store.actions.editFrame({
            kind: 'add',
            position: { x: 100, y: 180 },
            size: { width: 100, height: 100 }
        })!;
        store.actions.editFrame({
            kind: 'update',
            id: childId,
            changes: { parentFrameId: screenId }
        });
        store.actions.editFrame({ kind: 'reparentShapes', ids: [shapeId], parentFrameId: childId });
    });
    const [a, b] = copies;
    const document = shownDocument(a);
    const shapeId = document.shapesIds[0];
    const viewId = Object.values(document.frames).find(
        (frame) => frame.kind === 'view' && frame.position.x === 500
    )!.id;
    const screenId = document.frames[viewId].screenId!;
    const original = json(document.shapes[shapeId]);
    a.store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 600, y: 390 },
        screenViewId: viewId,
        handle: { shapeId, type: 'bottomRight' }
    });
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 640, y: 420 }, free: true });
    edit(b, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: screenId,
            changes: { stack: { direction: 'row', gap: 0, padding: 0, align: 'end' } }
        })
    );
    settle(copies);
    a.store.actions.events.endGesture({ pointerId: 1, position: { x: 640, y: 420 }, free: true });
    settle(copies);
    expect(json(shownDocument(a).shapes[shapeId])).toEqual(original);
    expect(json(shownDocument(b).shapes[shapeId])).toEqual(original);
    expect(shownDocument(a).frames[screenId].stack?.align).toBe('end');
    expect(a.store.state.events.pointer.gesture.kind).toBe('idle');
});

it('reuses the projected layout and agrees with a fresh layout check', () => {
    const { store, screenId, viewId, shapeId } = setup();
    const document = store.state.currentDocument;
    const placed = () =>
        projectScreenViews(document)
            .find((item) => item.view.id === viewId)!
            .projection!.layoutOffsets.has(shapeId);

    // No stack between the shape and its Screen: no viewport can move it.
    expect(placed()).toBe(false);
    expect(canTransformScreenViewShape(document, viewId, shapeId)).toBe(true);
    expect(screenViewTransformTarget(document, viewId, shapeId)?.stacked).toBe(false);

    // A child frame ends its row at 200px tall but sits lower in the 250px View.
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

    expect(placed()).toBe(true);
    expect(canTransformScreenViewShape(document, viewId, shapeId)).toBe(false);
    expect(screenViewTransformTarget(document, viewId, shapeId)?.stacked).toBe(true);
});
