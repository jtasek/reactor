import { registerTool } from 'src/app/actions/startup';
import { RectTool } from 'src/tools/components/Rect';
import { createTestStore } from './support/store';

// Tools are registered by application startup, which the test store skips.
registerTool(RectTool);

function storeWithTool(toolId: string) {
    const { store } = createTestStore();

    store.actions.tools.activateTool(toolId);

    return store;
}

function addRect(store: ReturnType<typeof storeWithTool>, x: number, y: number, selected = false) {
    store.actions.addShape({
        type: 'rectangle',
        position: { x, y },
        size: { width: 20, height: 20 },
        selected
    });

    return store.state.currentDocument.shapesIds[store.state.currentDocument.shapesIds.length - 1];
}

describe('pointer gestures', () => {
    it('commits a drawing once, using the release position', () => {
        const store = storeWithTool('rectangle');

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });
        store.actions.events.movePointer({ pointerId: 1, position: { x: 20, y: 20 } });
        store.actions.events.endGesture({ pointerId: 1, position: { x: 40, y: 30 } });
        store.actions.events.endGesture({ pointerId: 1, position: { x: 90, y: 90 } });

        const shapes = Object.values(store.state.currentDocument.shapes);

        expect(shapes).toHaveLength(1);
        expect(shapes[0].size).toEqual({ width: 30, height: 20 });
        expect(store.state.events.pointer.gesture.kind).toBe('idle');
        expect(store.state.tools.activeToolsIds).toEqual(['select']);
    });

    it('ignores input from pointers that do not own the gesture', () => {
        const store = storeWithTool('rectangle');

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });

        expect(
            store.actions.events.beginGesture({ pointerId: 2, position: { x: 90, y: 90 } })
        ).toBe(false);

        store.actions.events.movePointer({ pointerId: 2, position: { x: 90, y: 90 } });
        store.actions.events.endGesture({ pointerId: 2, position: { x: 90, y: 90 } });
        expect(store.actions.events.cancelGesture(2)).toBeNull();

        expect(store.state.events.pointer.start).toEqual({ x: 10, y: 10 });
        expect(store.state.events.pointer.current).toEqual({ x: 10, y: 10 });
        expect(store.state.events.pointer.gesture).toEqual({ kind: 'drawing', pointerId: 1 });
        expect(store.state.currentDocument.shapesIds).toEqual([]);
    });

    it('cancels a drawing without creating a shape', () => {
        const store = storeWithTool('rectangle');

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });
        store.actions.events.movePointer({ pointerId: 1, position: { x: 50, y: 50 } });

        expect(store.actions.events.cancelGesture()).toBe(1);
        store.actions.events.endGesture({ pointerId: 1, position: { x: 50, y: 50 } });

        expect(store.state.currentDocument.shapesIds).toEqual([]);
        expect(store.state.events.pointer.dragging).toBe(false);
        expect(store.state.tools.activeToolsIds).toEqual(['select']);
    });

    it('restores the selection changed by a canceled marquee', () => {
        const store = storeWithTool('select');
        const shapeId = addRect(store, 0, 0, true);

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 100, y: 100 } });
        store.actions.events.movePointer({ pointerId: 1, position: { x: 120, y: 120 } });

        expect(store.state.events.pointer.background).toBe(true);
        expect(store.state.currentDocument.shapes[shapeId].selected).toBe(false);

        store.actions.events.cancelGesture(1);

        expect(store.state.currentDocument.shapes[shapeId].selected).toBe(true);
        expect(store.state.events.pointer.background).toBe(false);
    });

    it('commits a marquee selection on release', () => {
        const store = storeWithTool('select');
        const inside = addRect(store, 10, 10);
        const outside = addRect(store, 200, 200);

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 0, y: 0 } });
        store.actions.events.endGesture({ pointerId: 1, position: { x: 50, y: 50 } });

        expect(store.state.currentDocument.shapes[inside].selected).toBe(true);
        expect(store.state.currentDocument.shapes[outside].selected).toBe(false);
    });

    it('restores the selection replaced by pressing a shape when the move is canceled', () => {
        const store = storeWithTool('select');
        const first = addRect(store, 0, 0, true);
        const second = addRect(store, 100, 100);

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 110, y: 110 } });

        expect(store.state.events.pointer.gesture.kind).toBe('moving');
        expect(store.state.currentDocument.shapes[second].selected).toBe(true);

        store.actions.events.cancelGesture();

        expect(store.state.currentDocument.shapes[first].selected).toBe(true);
        expect(store.state.currentDocument.shapes[second].selected).toBe(false);
        expect(store.state.tools.activeToolsIds).toEqual(['select']);
    });

    it('starts resize and rotate gestures from handles without changing the selection', () => {
        const store = storeWithTool('select');
        const shapeId = addRect(store, 0, 0);

        store.actions.events.beginGesture({
            pointerId: 3,
            position: { x: 20, y: 20 },
            handle: { shapeId, type: 'bottomRight' }
        });

        expect(store.state.events.pointer.gesture).toMatchObject({
            kind: 'resizing',
            pointerId: 3,
            shapeId,
            handle: 'bottomRight'
        });
        expect(store.state.currentDocument.shapes[shapeId].selected).toBe(false);

        store.actions.events.endGesture({ pointerId: 3, position: { x: 20, y: 20 } });
        store.actions.events.beginGesture({
            pointerId: 4,
            position: { x: 10, y: -20 },
            handle: { shapeId, type: 'rotate' }
        });

        expect(store.state.events.pointer.gesture).toMatchObject({
            kind: 'rotating',
            pointerId: 4,
            shapeId
        });
    });

    it('blocks zoom while a gesture is active', () => {
        const store = storeWithTool('rectangle');

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });
        store.actions.tools.zoomIn();
        store.actions.tools.zoomAtPoint({ point: { x: 0, y: 0 }, deltaY: -100 });

        expect(store.state.currentDocument.camera.scale).toBe(1);

        store.actions.events.cancelGesture();
        store.actions.tools.zoomIn();

        expect(store.state.currentDocument.camera.scale).toBeGreaterThan(1);
    });

    it('moves the selection by pointer deltas, including the release position', () => {
        const store = storeWithTool('select');
        const shapeId = addRect(store, 0, 0, true);

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });
        store.actions.events.movePointer({ pointerId: 1, position: { x: 15, y: 20 } });
        store.actions.events.endGesture({ pointerId: 1, position: { x: 40, y: 30 } });

        expect(store.state.currentDocument.shapes[shapeId].position).toEqual({ x: 30, y: 20 });
    });

    it('restores moved shapes when the move is canceled', () => {
        const store = storeWithTool('select');
        const first = addRect(store, 0, 0, true);
        const second = addRect(store, 100, 100, true);

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });
        store.actions.events.movePointer({ pointerId: 1, position: { x: 60, y: 40 } });

        expect(store.state.currentDocument.shapes[second].position).toEqual({ x: 150, y: 130 });

        store.actions.events.cancelGesture();

        expect(store.state.currentDocument.shapes[first].position).toEqual({ x: 0, y: 0 });
        expect(store.state.currentDocument.shapes[second].position).toEqual({ x: 100, y: 100 });
        expect(store.state.currentDocument.shapes[second].selected).toBe(true);
    });

    it('resizes live and restores the size when the resize is canceled', () => {
        const store = storeWithTool('select');
        const shapeId = addRect(store, 0, 0, true);
        const handle = { shapeId, type: 'bottomRight' as const };

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 20, y: 20 }, handle });
        store.actions.events.movePointer({ pointerId: 1, position: { x: 50, y: 40 } });

        expect(store.state.currentDocument.shapes[shapeId].size).toEqual({
            width: 50,
            height: 40
        });

        store.actions.events.cancelGesture();

        expect(store.state.currentDocument.shapes[shapeId].size).toEqual({
            width: 20,
            height: 20
        });
        expect(store.state.currentDocument.shapes[shapeId].position).toEqual({ x: 0, y: 0 });
    });

    it('rotates live and restores the rotation when the rotation is canceled', () => {
        const store = storeWithTool('select');
        const shapeId = addRect(store, 0, 0, true);
        const handle = { shapeId, type: 'rotate' as const };

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 10, y: -20 }, handle });
        store.actions.events.endGesture({ pointerId: 1, position: { x: 40, y: 10 } });

        expect(store.state.currentDocument.shapes[shapeId].rotation).toBe(90);

        store.actions.events.beginGesture({ pointerId: 2, position: { x: 40, y: 10 }, handle });
        store.actions.events.movePointer({ pointerId: 2, position: { x: 10, y: 40 } });

        expect(store.state.currentDocument.shapes[shapeId].rotation).toBe(180);

        store.actions.events.cancelGesture();

        expect(store.state.currentDocument.shapes[shapeId].rotation).toBe(90);
    });

    it('does not resurrect a shape deleted during a canceled gesture', () => {
        const store = storeWithTool('select');
        const shapeId = addRect(store, 0, 0, true);

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });
        store.actions.removeShape(shapeId);
        store.actions.events.cancelGesture();

        expect(store.state.currentDocument.shapes[shapeId]).toBeUndefined();
        expect(store.state.currentDocument.shapesIds).toEqual([]);
    });

    it('treats a handle of a missing shape as empty canvas', () => {
        const store = storeWithTool('select');

        expect(
            store.actions.events.beginGesture({
                pointerId: 1,
                position: { x: 0, y: 0 },
                handle: { shapeId: 'missing', type: 'rotate' }
            })
        ).toBe(true);
        expect(store.state.events.pointer.gesture.kind).toBe('marquee');
    });
});
