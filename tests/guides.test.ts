import { registerCommand, registerTool } from 'src/app/actions/startup';
import { snapToGuides } from 'src/app/snapping';
import { createGuide } from 'src/app/factories';
import { DeleteCommand } from 'src/commands/delete';
import { RectTool } from 'src/tools/components/Rect';
import { createTestStore } from './support/store';

registerTool(RectTool);
registerCommand(DeleteCommand);

function setup() {
    const { store } = createTestStore();
    store.actions.ui.showControl('guides');
    store.actions.addGuide({ id: 'vertical', orientation: 'vertical', position: { x: 100, y: 0 } });
    store.actions.addGuide({
        id: 'horizontal',
        orientation: 'horizontal',
        position: { x: 0, y: 200 }
    });
    return store;
}

it('snaps each axis to its nearest shown guide, including locked guides', () => {
    const guides = [
        createGuide({ orientation: 'vertical', position: { x: 100, y: 0 }, locked: true }),
        createGuide({ orientation: 'vertical', position: { x: 104, y: 0 } }),
        createGuide({ orientation: 'horizontal', position: { x: 0, y: 200 } }),
        createGuide({ orientation: 'horizontal', position: { x: 0, y: 203 }, visible: false })
    ];
    expect(snapToGuides({ x: 101, y: 204 }, guides, 6)).toEqual({ x: 100, y: 200 });
    expect(snapToGuides({ x: 90, y: 207 }, guides, 6)).toEqual({ x: 90, y: 207 });
});

it('snaps both the drawing origin and release, and commits the preview geometry', () => {
    const store = setup();
    store.actions.tools.activateTool('rectangle');
    store.actions.events.beginGesture({ pointerId: 1, position: { x: 103, y: 50 } });
    expect(store.state.events.pointer.start).toEqual({ x: 100, y: 50 });
    store.actions.events.movePointer({ pointerId: 1, position: { x: 150, y: 197 } });
    expect(store.state.events.pointer.current).toEqual({ x: 150, y: 200 });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 160, y: 198 } });
    expect(Object.values(store.state.currentDocument.shapes)[0]).toMatchObject({
        position: { x: 100, y: 50 },
        size: { width: 60, height: 150 }
    });
});

it('uses a screen-pixel snap distance at zoom', () => {
    const store = setup();
    store.actions.tools.zoom({ scale: 2, point: { x: 0, y: 0 } });
    store.actions.tools.activateTool('rectangle');
    store.actions.events.beginGesture({ pointerId: 1, position: { x: 104, y: 50 } });
    expect(store.state.events.pointer.start.x).toBe(104);
    store.actions.events.movePointer({ pointerId: 1, position: { x: 103, y: 197 } });
    expect(store.state.events.pointer.current).toEqual({ x: 100, y: 200 });
});

it.each(['hidden', 'free'])('does not snap when guides are %s', (mode) => {
    const store = setup();
    if (mode === 'hidden') {
        store.actions.ui.hideControl('guides');
    }
    store.actions.tools.activateTool('rectangle');
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 103, y: 50 },
        free: mode === 'free'
    });
    store.actions.events.endGesture({
        pointerId: 1,
        position: { x: 150, y: 197 },
        free: mode === 'free'
    });
    expect(Object.values(store.state.currentDocument.shapes)[0]).toMatchObject({
        position: { x: 103, y: 50 },
        size: { width: 47, height: 147 }
    });
});

it('selects and deletes a guide without deleting the previously selected shape', () => {
    const store = setup();
    store.actions.drawShape({
        type: 'rectangle',
        position: { x: 10, y: 10 },
        size: { width: 20, height: 20 }
    });
    store.actions.selectGuide('vertical');
    expect(store.state.currentDocument.selectedShapesIds).toEqual([]);
    expect(store.state.currentDocument.guides.vertical.selected).toBe(true);
    expect(store.actions.runCommand(DeleteCommand)).toBe(true);
    expect(store.state.currentDocument.guides.vertical).toBeUndefined();
    expect(store.state.currentDocument.shapesIds).toHaveLength(1);
});

it.each([false, true])(
    'a shape-menu delete keeps a previously selected guide (shape locked: %s)',
    (locked) => {
        const store = setup();
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 10, y: 10 },
            size: { width: 20, height: 20 },
            locked
        });
        const shapeId = store.state.currentDocument.shapesIds[0];
        store.actions.selectGuide('vertical');
        store.actions.runCommandOn({ shapeIds: [shapeId], commandId: 'delete' });
        expect(store.state.currentDocument.guides.vertical).toBeDefined();
        expect(store.state.currentDocument.guides.vertical.selected).toBe(locked);
        expect(store.state.currentDocument.shapesIds).toHaveLength(locked ? 1 : 0);
    }
);

it.each(['guide lock', 'document lock', 'hidden control', 'hidden guide'])(
    'does not delete a guide with %s',
    (reason) => {
        const store = setup();
        store.actions.selectGuide('vertical');
        if (reason === 'guide lock') {
            store.actions.lockGuide('vertical');
        }
        if (reason === 'document lock') {
            store.actions.lockDocument(store.state.currentDocumentId);
        }
        if (reason === 'hidden control') {
            store.actions.ui.hideControl('guides');
        }
        if (reason === 'hidden guide') {
            store.actions.hideGuide('vertical');
        }
        expect(store.actions.runCommand(DeleteCommand)).toBe(false);
        expect(store.state.currentDocument.guides.vertical).toBeDefined();
    }
);

it('clears guide selection on a canvas click and leaves its position unchanged', () => {
    const store = setup();
    store.actions.selectGuide('vertical');
    store.actions.events.beginGesture({ pointerId: 1, position: { x: 300, y: 300 } });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 300, y: 300 } });
    expect(store.state.currentDocument.guides.vertical.selected).toBe(false);
    expect(store.state.currentDocument.guides.vertical.position.x).toBe(100);
});
