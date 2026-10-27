import { json } from 'overmind';
import { createTestStore } from './support/store';
import { registerTool } from 'src/app/actions/startup';
import { RectTool } from 'src/tools/components/Rect';
import { TextTool } from 'src/tools/components/Text';
import { LineTool } from 'src/tools/components/Line';
import { createShape } from 'src/app/factories';
import { writeClipboard } from 'src/app/clipboard';
import {
    componentScreenView,
    editableScreenView,
    pointerDocument
} from 'src/app/screenViewEditing';
import { componentViewPoint } from 'src/app/componentViewTransform';
import { boxCenter, getShapeBounds } from 'src/app/utils';
import { MoveRightCommand } from 'src/commands/move';
import { CloneCommand } from 'src/commands/clone';
import { selectionOverlay } from 'src/app/selectionOverlays';
import { serializePersistedState } from 'src/app/services/documentStorage';
import type { Point, Rectangle } from 'src/app/types';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

registerTool(RectTool);
registerTool(TextTool);
registerTool(LineTool);

function setup(rotation = 90, stacked = false, store = createTestStore().store) {
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
    for (const x of [120, 180]) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x, y: 110 },
            size: { width: 40, height: 40 }
        });
    }
    const document = store.state.currentDocument;
    const [firstId, secondId] = document.shapesIds;
    store.actions.addComponent({
        id: 'card',
        name: 'Card',
        sourceOnly: true,
        shapesIds: [firstId, secondId]
    });
    store.actions.drawShape({
        type: 'instance',
        componentId: 'card',
        position: { x: 140, y: 200 },
        rotation,
        parentFrameId: screenId,
        overrides: {}
    });
    const instanceId = document.selectedShapesIds[0];

    if (stacked) {
        store.actions.editFrame({
            kind: 'update',
            id: screenId,
            changes: { stack: { direction: 'row', padding: 20, gap: 10, align: 'center' } }
        });
    }
    store.actions.events.setScreenView(viewId);
    store.actions.selectComponentSource('card');
    store.actions.selectComponentChild({ componentId: 'card', shapeId: firstId });

    const transform = () =>
        editableScreenView(store.state, store.state.events.pointer.screenView)!.component!;
    const point = (source: Point) => componentViewPoint(source, transform());

    return {
        store,
        document,
        screenId,
        viewId,
        mobileId,
        instanceId,
        firstId,
        secondId,
        transform,
        point
    };
}

it.each([0, 90, 27])(
    'projects a %s° stacked instance without writing its layout or master geometry',
    (rotation) => {
        const { store, document, viewId, firstId, instanceId } = setup(rotation, true);
        const before = serializePersistedState(store.state);
        expect(componentScreenView(store.state)?.viewId).toBe(viewId);
        expect(pointerDocument(store.state).shapes[firstId].rotation ?? 0).toBe(rotation);
        expect(selectionOverlay(store.state)?.viewId).toBe(viewId);
        expect(document.shapes[instanceId]).toMatchObject({
            position: { x: 140, y: 200 },
            rotation
        });
        expect(serializePersistedState(store.state)).toEqual(before);
    }
);

it.each([90, 27])(
    'maps a %s° drag to source axes and keeps its stack footprint pinned until exit',
    (rotation) => {
        const { store, document, viewId, firstId, instanceId, point, transform } = setup(
            rotation,
            true
        );
        const instance = json(document.shapes[instanceId]);
        const placement = json(transform());
        const start = point({ x: 140, y: 130 });
        expect(
            store.actions.events.beginGesture({
                pointerId: 1,
                position: start,
                screenViewId: viewId
            })
        ).toBe(true);
        store.actions.events.movePointer({
            pointerId: 1,
            position: point({ x: 150, y: 140 }),
            free: true
        });
        store.actions.events.endGesture({
            pointerId: 1,
            position: point({ x: 160, y: 145 }),
            free: true
        });
        expect(document.shapes[firstId]).toMatchObject({
            position: { x: expect.closeTo(140), y: expect.closeTo(125) }
        });
        expect(transform()).toEqual(placement);
        expect(document.shapes[instanceId]).toEqual(instance);
        store.actions.leaveComponentSource();
        expect(document.selectedShapesIds).toEqual([instanceId]);
        expect(document.shapes[instanceId]).toEqual({ ...instance, selected: true });
    }
);

it.each([90, 27])('resizes and rotates a child through a %s° stacked instance', (rotation) => {
    const { store, document, viewId, firstId, point } = setup(rotation, true);
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: point({ x: 160, y: 150 }),
            screenViewId: viewId,
            handle: { shapeId: firstId, type: 'bottomRight' }
        })
    ).toBe(true);
    store.actions.events.movePointer({
        pointerId: 1,
        position: point({ x: 170, y: 160 }),
        free: true
    });
    store.actions.events.endGesture({
        pointerId: 1,
        position: point({ x: 180, y: 170 }),
        free: true
    });
    expect(document.shapes[firstId]).toMatchObject({
        position: { x: expect.closeTo(120), y: expect.closeTo(110) },
        size: { width: expect.closeTo(60), height: expect.closeTo(60) }
    });
    const center = boxCenter(getShapeBounds(document.shapes[firstId]));
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: point({ x: center.x, y: center.y - 54 }),
            screenViewId: viewId,
            handle: { shapeId: firstId, type: 'rotate' }
        })
    ).toBe(true);
    store.actions.events.endGesture({
        pointerId: 1,
        position: point({ x: center.x + 54, y: center.y }),
        free: true
    });
    expect(document.shapes[firstId].rotation).toBeCloseTo(90);
});

it('draws, nudges, duplicates and pastes into a rotated master without rotating the instance', () => {
    const { store, document, viewId, firstId, instanceId, transform } = setup();
    const original = json(document.shapes[instanceId]);
    store.actions.runCommand(MoveRightCommand);
    expect(document.shapes[firstId]).toMatchObject({ position: { x: 120, y: 100 } });
    store.actions.runCommand(CloneCommand);
    const cloneId = document.selectedShapesIds[0];
    expect(document.shapes[cloneId]).toMatchObject({ position: { x: 130, y: 90 } });
    const text = store.actions.copySelection()!;
    expect(store.actions.pasteShapes(text)).toBe('pasted');
    const pastedId = document.selectedShapesIds[0];
    expect(document.shapes[pastedId].rotation ?? 0).toBe(0);
    expect(document.components.card.shapesIds).toContain(pastedId);
    store.actions.tools.activateTool('rectangle');
    const placement = json(transform());
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 700, y: 450 },
            screenViewId: viewId
        })
    ).toBe(true);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 740, y: 490 } });
    const drawnId = document.selectedShapesIds[0];
    expect(document.components.card.shapesIds).toContain(drawnId);
    expect(document.shapes[drawnId].parentFrameId).toBeUndefined();
    expect(document.shapes[drawnId].rotation).toBe(-90);
    const drawn = pointerDocument(store.state).shapes[drawnId];
    expect(drawn).toMatchObject({
        position: { x: expect.closeTo(700), y: expect.closeTo(450) },
        size: { width: 40, height: 40 },
        rotation: 0
    });
    expect(transform()).toEqual(placement);
    expect(document.shapes[instanceId]).toEqual(original);
});

it('aligns in displayed axes through a rotated instance', () => {
    const { store, document, firstId, secondId } = setup();
    store.actions.selectShape(secondId);
    expect(store.state.alignmentItems).toHaveLength(2);
    store.actions.alignSelection('top');
    const placed = pointerDocument(store.state);
    expect(getShapeBounds(placed.shapes[firstId]).topLeft.y).toBeCloseTo(
        getShapeBounds(placed.shapes[secondId]).topLeft.y
    );
    expect(document.shapes[secondId]).toMatchObject({
        position: { x: expect.closeTo(120), y: 110 }
    });
});

it('keeps an unmoved source-axis binding when nudging through a quarter-turned instance', () => {
    const { store, document, firstId } = setup();
    const variableId = store.actions.createVariable({ name: 'left', type: 'number', value: 120 })!;
    store.actions.bindProperty({ shapeIds: [firstId], key: 'x', variableId });
    store.actions.runCommand(MoveRightCommand);
    expect(document.shapes[firstId]).toMatchObject({
        position: { x: 120, y: 100 },
        bindings: { x: variableId }
    });
});

it('rounds a nudge through an uneven-angle instance to whole source pixels', () => {
    const { store, document, firstId } = setup(27);
    const position = () => (document.shapes[firstId] as Rectangle).position;
    const before = json(position());
    const step = store.state.config.arrowKeyStep;

    for (let i = 0; i < 3; i++) {
        store.actions.runCommand(MoveRightCommand);
    }

    const after = position();
    expect(Number.isInteger(after.x)).toBe(true);
    expect(Number.isInteger(after.y)).toBe(true);
    // Each displayed step to the right moves right and up in the master, as rotation says.
    const turned = {
        x: Math.round(step * Math.cos((27 * Math.PI) / 180)),
        y: Math.round(-step * Math.sin((27 * Math.PI) / 180))
    };
    expect(after).toEqual({ x: before.x + 3 * turned.x, y: before.y + 3 * turned.y });
});

it('draws a line through a rotated instance with the same displayed endpoints as its preview', () => {
    const { store, document, viewId } = setup(27, true);
    store.actions.tools.activateTool('line');
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 700, y: 440 },
            screenViewId: viewId
        })
    ).toBe(true);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 760, y: 470 }, free: true });
    const id = document.selectedShapesIds[0];
    const shown = pointerDocument(store.state).shapes[id];
    expect(shown).toMatchObject({
        type: 'line',
        rotation: 0,
        start: { x: expect.closeTo(700), y: expect.closeTo(440) },
        end: { x: expect.closeTo(760), y: expect.closeTo(470) }
    });
    expect(document.shapes[id].rotation).toBe(-27);
    expect(document.components.card.shapesIds).toContain(id);
});

it('preserves relative placement when pasting a nested instance alongside a primitive', () => {
    const { store, document } = setup();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 20, y: 20 },
        size: { width: 40, height: 20 }
    });
    const badgeChild = document.shapesIds.at(-1)!;
    store.actions.addComponent({
        id: 'badge',
        name: 'Badge',
        sourceOnly: true,
        shapesIds: [badgeChild]
    });
    const shapes = [
        createShape({
            type: 'rectangle',
            name: 'Copied rectangle',
            order: 'a0',
            position: { x: 700, y: 440 },
            size: { width: 40, height: 20 }
        }),
        createShape({
            type: 'instance',
            name: 'Copied badge',
            order: 'a1',
            componentId: 'badge',
            position: { x: 760, y: 440 },
            overrides: {}
        })
    ];
    const copied = writeClipboard(shapes, [], {}, document);
    expect(store.actions.pasteShapes(copied)).toBe('pasted');
    const placed = pointerDocument(store.state);
    const pasted = document.selectedShapesIds.map((id) => placed.shapes[id]);
    const primitive = pasted.find((shape) => shape.type === 'rectangle')!;
    const instance = pasted.find((shape) => shape.type === 'instance')!;
    const primitiveCenter = boxCenter(getShapeBounds(primitive));
    const instanceCenter = boxCenter(getShapeBounds(instance));
    expect(instanceCenter.x - primitiveCenter.x).toBeCloseTo(60);
    expect(instanceCenter.y - primitiveCenter.y).toBeCloseTo(0);
    expect(instance.rotation ?? 0).toBe(0);
    expect(document.components.card.shapesIds).toEqual(
        expect.arrayContaining(document.selectedShapesIds)
    );
});

it('anchors two-phase text in source space even when its rotated view is removed', () => {
    const { store, document, viewId } = setup(27, true);
    store.actions.tools.activateTool('text');
    expect(
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 700, y: 450 },
            screenViewId: viewId
        })
    ).toBe(true);
    store.actions.events.endGesture({ pointerId: 1, position: { x: 700, y: 450 } });
    store.actions.events.typing('Caption');
    store.actions.applyRemoteChanges({
        documentId: document.id,
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
    store.actions.tools.executeToolCommands();
    const text = document.shapes[document.selectedShapesIds[0]];
    expect(text).toMatchObject({ type: 'text', value: 'Caption', rotation: -27 });
    expect(text.parentFrameId).toBeUndefined();
    expect(document.components.card.shapesIds).toContain(text.id);
});

it.each(['rotation', 'stack', 'view', 'lock', 'delete'] as const)(
    'cancels a focused gesture when its %s context changes',
    (change) => {
        const { store, document, viewId, screenId, firstId, instanceId, point } = setup(27, true);
        const original = json(document.shapes[firstId]);
        expect(
            store.actions.events.beginGesture({
                pointerId: 1,
                position: point({ x: 140, y: 130 }),
                screenViewId: viewId
            })
        ).toBe(true);
        const target = point({ x: 155, y: 140 });
        store.actions.events.movePointer({ pointerId: 1, position: target, free: true });
        if (change === 'rotation') {
            store.actions.setShapesProperty({ shapeIds: [instanceId], key: 'rotation', value: 50 });
        }
        if (change === 'stack') {
            store.actions.applyRemoteChanges({
                documentId: document.id,
                entities: {
                    frames: {
                        [screenId]: {
                            view: {
                                ...json(document.frames[screenId]),
                                stack: { direction: 'row', padding: 30, gap: 10, align: 'center' }
                            },
                            changed: ['stack']
                        }
                    },
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
        }
        if (change === 'view') {
            store.actions.applyRemoteChanges({
                documentId: document.id,
                entities: {
                    frames: {
                        [viewId]: {
                            view: {
                                ...json(document.frames[viewId]),
                                position: { x: 550, y: 300 }
                            },
                            changed: ['position']
                        }
                    },
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
        }
        if (change === 'lock') {
            store.actions.setShapesProperty({ shapeIds: [instanceId], key: 'locked', value: true });
        }
        if (change === 'delete') {
            store.actions.removeShapes([instanceId]);
        }
        store.actions.events.movePointer({ pointerId: 1, position: target, free: true });
        expect(store.state.events.pointer.gesture.kind).toBe('idle');
        expect(document.shapes[firstId]).toEqual(original);
    }
);

it('shares and undoes transformed edits and keeps remote fields on cancellation', async () => {
    const copies = await createCopies(2, (store) => setup(27, true, store));
    const [a, b] = copies;
    const document = shownDocument(a);
    const firstId = document.components.card.shapesIds[0];
    const viewId = Object.values(document.frames).find(
        (frame) => frame.kind === 'view' && frame.position.x === 500
    )!.id;
    a.store.actions.events.setScreenView(viewId);
    a.store.actions.selectComponentSource('card');
    a.store.actions.selectComponentChild({ componentId: 'card', shapeId: firstId });
    const transform = editableScreenView(
        a.store.state,
        a.store.state.events.pointer.screenView
    )!.component!;
    const start = componentViewPoint({ x: 160, y: 150 }, transform);
    const target = componentViewPoint({ x: 180, y: 170 }, transform);
    const begin = () =>
        a.store.actions.events.beginGesture({
            pointerId: 1,
            position: start,
            screenViewId: viewId,
            handle: { shapeId: firstId, type: 'bottomRight' }
        });
    expect(begin()).toBe(true);
    a.store.actions.events.movePointer({ pointerId: 1, position: target, free: true });
    edit(b, (actions) =>
        actions.setShapesProperty({ shapeIds: [firstId], key: 'name', value: 'Remote child' })
    );
    settle(copies);
    a.store.actions.events.cancelGesture();
    settle(copies);
    expect(shownDocument(a).shapes[firstId]).toMatchObject({
        name: 'Remote child',
        size: { width: 40, height: 40 }
    });
    expect(begin()).toBe(true);
    a.store.actions.events.endGesture({ pointerId: 1, position: target, free: true });
    settle(copies);
    expect(shownDocument(b).shapes[firstId]).toMatchObject({
        size: { width: expect.closeTo(60), height: expect.closeTo(60) }
    });
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).shapes[firstId]).toMatchObject({
        name: 'Remote child',
        size: { width: 40, height: 40 }
    });
});
