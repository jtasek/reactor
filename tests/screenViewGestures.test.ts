import { json } from 'overmind';
import { registerTool } from 'src/app/actions/startup';
import { RectTool } from 'src/tools/components/Rect';
import { LineTool } from 'src/tools/components/Line';
import { TextTool } from 'src/tools/components/Text';
import { FrameTool } from 'src/tools/components/Frame';
import { projectScreenViews } from 'src/app/screenProjection';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

for (const tool of [RectTool, LineTool, TextTool, FrameTool]) {
    registerTool(tool);
}

function addViews(store: ReturnType<typeof createTestStore>['store']) {
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

    return { screenId, viewId };
}

function setup() {
    const { store } = createTestStore();

    return { store, ...addViews(store) };
}

it.each(['rectangle', 'line'])(
    'draws a %s in source coordinates, parents it to the screen and leaves view geometry intact',
    (tool) => {
        const { store, screenId, viewId } = setup();
        const frames = json(store.state.currentDocument.frames);
        store.actions.tools.activateTool(tool);
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 520, y: 330 },
            screenViewId: viewId
        });
        store.actions.events.endGesture({ pointerId: 1, position: { x: 560, y: 360 } });
        const document = store.state.currentDocument;
        const shape = document.shapes[document.shapesIds[0]];
        expect(shape).toMatchObject({ type: tool, parentFrameId: screenId });
        expect(shape).toMatchObject(
            tool === 'line'
                ? { start: { x: 120, y: 110 }, end: { x: 160, y: 140 } }
                : { position: { x: 120, y: 110 }, size: { width: 40, height: 30 } }
        );
        expect(
            projectScreenViews(document).find((item) => item.view.id === viewId)?.projection
                ?.shapes[0]
        ).toMatchObject(
            tool === 'line' ? { start: { x: 520, y: 330 } } : { position: { x: 520, y: 330 } }
        );
        expect(json(document.frames)).toEqual(frames);
    }
);

it('keeps the view address through two-phase text placement and draws nested frames in the source', () => {
    const { store, screenId, viewId } = setup();
    store.actions.tools.activateTool('text');
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 520, y: 330 },
        screenViewId: viewId
    });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 520, y: 330 } });
    store.actions.events.typing('Hello');
    store.actions.tools.executeToolCommands();
    store.actions.events.endTyping();
    store.actions.tools.resetTools();
    expect(Object.values(store.state.currentDocument.shapes)[0]).toMatchObject({
        type: 'text',
        value: 'Hello',
        position: { x: 120, y: 110 },
        parentFrameId: screenId
    });
    store.actions.tools.activateTool('frame');
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 550, y: 350 },
        screenViewId: viewId
    });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 650, y: 450 } });
    expect(
        Object.values(store.state.currentDocument.frames).find(
            (frame) => frame.parentFrameId === screenId
        )
    ).toMatchObject({ position: { x: 150, y: 130 }, size: { width: 100, height: 100 } });
});

it('hits viewport-specific layout, keeps stack-managed artwork fixed and moves free source artwork with cancellation', () => {
    const { store, screenId, viewId } = setup();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 120, y: 100 },
        size: { width: 40, height: 30 },
        parentFrameId: screenId
    });
    const document = store.state.currentDocument;
    const id = document.shapesIds[0];
    store.actions.editFrame({
        kind: 'update',
        id: screenId,
        changes: { stack: { direction: 'column', gap: 0, padding: 10, align: 'end' } }
    });
    store.actions.tools.activateTool('select');
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 970, y: 320 },
        screenViewId: viewId
    });
    expect(document.shapes[id].selected).toBe(true);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 990, y: 340 } });
    expect(document.shapes[id]).toMatchObject({ position: { x: 120, y: 100 } });
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { stack: null } });
    const original = json(document.shapes[id]);
    const projected = projectScreenViews(document).find((item) => item.view.id === viewId)!
        .projection!.shapes[0];
    const position = projected.type === 'rectangle' ? projected.position : { x: 0, y: 0 };
    store.actions.events.beginGesture({ pointerId: 1, position, screenViewId: viewId });
    store.actions.events.movePointer({
        pointerId: 1,
        position: { x: position.x + 30, y: position.y + 20 },
        free: true
    });
    expect(document.shapes[id]).not.toEqual(original);
    store.actions.events.cancelGesture();
    expect(json(document.shapes[id])).toEqual(original);
});

it('cancels drawing and rejects locked or invalid addresses without creating loose shapes', () => {
    const { store, screenId, viewId } = setup();
    store.actions.tools.activateTool('rectangle');
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 520, y: 330 },
        screenViewId: viewId
    });
    store.actions.events.cancelGesture();
    store.actions.editFrame({ kind: 'toggle', id: viewId, flag: 'locked' });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 560, y: 360 } });
    expect(store.state.currentDocument.shapesIds).toHaveLength(0);
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 520, y: 330 },
            screenViewId: viewId
        })
    ).toBe(false);
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'frame' } });
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 520, y: 330 },
            screenViewId: viewId
        })
    ).toBe(false);
});

it('shares a drag through a view, preserves a remote edit on cancel, and undoes a committed drag', async () => {
    const copies = await createCopies(2, (store) => {
        const { screenId } = addViews(store);
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 120, y: 110 },
            size: { width: 40, height: 30 },
            parentFrameId: screenId
        });
    });
    const [a, b] = copies;
    const viewId = Object.values(shownDocument(a).frames).find(
        (frame) => frame.kind === 'view' && frame.position.x === 500
    )!.id;
    const shapeId = shownDocument(a).shapesIds[0];
    const drag = () => {
        a.store.actions.tools.activateTool('select');
        a.store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 525, y: 335 },
            screenViewId: viewId
        });
        a.store.actions.events.movePointer({
            pointerId: 1,
            position: { x: 555, y: 355 },
            free: true
        });
    };
    drag();
    edit(b, (actions) =>
        actions.setShapesProperty({ shapeIds: [shapeId], key: 'name', value: 'Remote' })
    );
    settle(copies);
    a.store.actions.events.cancelGesture();
    settle(copies);
    expect(shownDocument(a).shapes[shapeId]).toMatchObject({
        name: 'Remote',
        position: { x: 120, y: 110 }
    });
    drag();
    a.store.actions.events.endGesture({ pointerId: 1, position: { x: 555, y: 355 }, free: true });
    settle(copies);
    expect(shownDocument(b).shapes[shapeId]).toMatchObject({ position: { x: 150, y: 130 } });
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).shapes[shapeId]).toMatchObject({
        name: 'Remote',
        position: { x: 120, y: 110 }
    });
});

it.each(['lock', 'resize', 'hide', 'delete'] as const)(
    'cancels a gesture after a remote view %s',
    async (change) => {
        const copies = await createCopies(2, addViews);
        const [a, b] = copies;
        const viewId = Object.values(shownDocument(a).frames).find(
            (frame) => frame.kind === 'view' && frame.position.x === 500
        )!.id;
        a.store.actions.tools.activateTool('rectangle');
        a.store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 520, y: 330 },
            screenViewId: viewId
        });
        edit(b, (actions) => {
            if (change === 'delete') {
                actions.editFrame({ kind: 'delete', id: viewId });

                return;
            }

            if (change === 'resize') {
                actions.editFrame({
                    kind: 'update',
                    id: viewId,
                    changes: { size: { width: 600, height: 250 } }
                });

                return;
            }

            actions.editFrame({
                kind: 'toggle',
                id: viewId,
                flag: change === 'lock' ? 'locked' : 'visible'
            });
        });
        settle(copies);
        a.store.actions.events.endGesture({ pointerId: 1, position: { x: 560, y: 360 } });
        settle(copies);
        expect(shownDocument(a).shapesIds).toHaveLength(0);
        expect(shownDocument(b).shapesIds).toHaveLength(0);
        expect(a.store.state.events.pointer.gesture.kind).toBe('idle');
    }
);

it('drags a group by the gap between its projected members and scopes marquee selection to the pressed view', () => {
    const { store, screenId, viewId } = setup();
    for (const x of [120, 200]) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x, y: 110 },
            size: { width: 30, height: 30 },
            parentFrameId: screenId
        });
    }
    const document = store.state.currentDocument;
    const ids = [...document.shapesIds];
    store.actions.addGroup({ shapesIds: ids });
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 510, y: 310 },
        size: { width: 150, height: 60 }
    });
    const outsider = document.shapesIds.at(-1)!;
    store.actions.unselectShapes();
    store.actions.tools.activateTool('select');
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 570, y: 340 },
        screenViewId: viewId
    });
    expect(document.shapes[ids[0]].selected).toBe(true);
    expect(document.shapes[ids[1]].selected).toBe(true);
    expect(document.shapes[outsider].selected).toBe(false);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 600, y: 360 }, free: true });
    expect(document.shapes[ids[0]]).toMatchObject({ position: { x: 150, y: 130 } });
    expect(document.shapes[ids[1]]).toMatchObject({ position: { x: 230, y: 130 } });
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 505, y: 305 },
        screenViewId: viewId
    });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 680, y: 380 } });
    expect(document.shapes[ids[0]].selected).toBe(true);
    expect(document.shapes[ids[1]].selected).toBe(true);
    expect(document.shapes[outsider].selected).toBe(false);
});

it('moves the complete existing selection when a selected shape is dragged through a view', () => {
    const { store, screenId, viewId } = setup();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 120, y: 110 },
        size: { width: 40, height: 30 },
        parentFrameId: screenId
    });
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 50, y: 500 },
        size: { width: 40, height: 30 }
    });
    const document = store.state.currentDocument;
    const [inside, outside] = document.shapesIds;
    store.actions.unselectShapes();
    store.actions.selectShape(inside);
    store.actions.selectShape(outside);
    store.actions.tools.activateTool('select');
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 525, y: 335 },
        screenViewId: viewId
    });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 555, y: 355 }, free: true });
    expect(document.shapes[inside]).toMatchObject({ position: { x: 150, y: 130 }, selected: true });
    expect(document.shapes[outside]).toMatchObject({ position: { x: 80, y: 520 }, selected: true });
});

it('keeps pending text anchored to its chosen source location when its view moves', () => {
    const { store, screenId, viewId } = setup();
    store.actions.tools.activateTool('text');
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 520, y: 330 },
        screenViewId: viewId
    });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 520, y: 330 } });
    store.actions.events.typing('Anchored');
    store.actions.editFrame({
        kind: 'update',
        id: viewId,
        changes: { position: { x: 700, y: 400 } }
    });
    store.actions.tools.executeToolCommands();
    const document = store.state.currentDocument;
    expect(document.shapes[document.shapesIds[0]]).toMatchObject({
        type: 'text',
        position: { x: 120, y: 110 },
        parentFrameId: screenId
    });
});
