import { registerTool } from 'src/app/actions/startup';
import { MoveTool, RectTool, SelectTool } from 'src/tools';
import { createTestStore } from './support/store';

// Tools are registered by application startup, which the test store skips.
[RectTool, SelectTool, MoveTool].forEach(registerTool);

type Store = ReturnType<typeof createTestStore>['store'];

function drag(store: Store, from: { x: number; y: number }, to: { x: number; y: number }) {
    const { events } = store.actions;

    events.beginGesture({ pointerId: 1, position: from });
    events.movePointer({ pointerId: 1, position: to });
    events.endGesture({ pointerId: 1, position: to });
}

function drawSquare(store: Store, x: number) {
    store.actions.tools.activateTool('rectangle');
    drag(store, { x, y: 0 }, { x: x + 40, y: 40 });
}

const selectedIds = (store: Store) => store.state.currentDocument.selectedShapesIds;

it('selects a drawn shape alone, in place of the selection', () => {
    const { store } = createTestStore();

    drawSquare(store, 0);
    drawSquare(store, 100);

    const [first, second] = store.state.currentDocument.shapesIds;

    expect(selectedIds(store)).toEqual([second]);

    // So dragging the first shape moves it alone.
    drag(store, { x: 20, y: 20 }, { x: 30, y: 30 });

    expect(selectedIds(store)).toEqual([first]);
    expect(store.state.currentDocument.shapes[second]).toMatchObject({
        position: { x: 100, y: 0 }
    });
});
