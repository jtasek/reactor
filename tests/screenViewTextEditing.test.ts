import { registerTool } from 'src/app/actions/startup';
import { TextTool } from 'src/tools/components/Text';
import { createTestStore } from './support/store';

registerTool(TextTool);

type Store = ReturnType<typeof createTestStore>['store'];

function setup() {
    const { store } = createTestStore();
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
        size: { width: 300, height: 200 }
    })!;
    const textId = addText(store, viewId, 'Welcome');

    return { store, screenId, viewId, textId };
}

/** Types words with the text tool at (520, 330) in the view. */
function addText(store: Store, viewId: string, words: string) {
    const before = new Set(store.state.currentDocument.shapesIds);
    store.actions.tools.activateTool('text');
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 520, y: 330 },
        screenViewId: viewId
    });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 520, y: 330 } });
    store.actions.events.typing(words);
    store.actions.tools.executeToolCommands();
    store.actions.events.endTyping();
    store.actions.tools.resetTools();

    return store.state.currentDocument.shapesIds.find((id) => !before.has(id))!;
}

/** Presses and releases at a point of the view, then double-clicks there. */
function doubleClick(store: Store, viewId: string, position = { x: 525, y: 325 }) {
    store.actions.events.beginGesture({ pointerId: 1, position, screenViewId: viewId });
    store.actions.events.endGesture({ pointerId: 1, position });

    return store.actions.editTextAtPointer();
}

it('edits text on a page where it is shown, and the words land on the page', () => {
    const { store, screenId, viewId, textId } = setup();

    expect(doubleClick(store, viewId)).toBe(true);
    expect(store.state.editingText).toEqual({
        documentId: store.state.currentDocumentId,
        shapeId: textId,
        viewId
    });

    store.actions.setShapesProperty({ shapeIds: [textId], key: 'text', value: 'Hello' });
    store.actions.endTextEditing();

    expect(store.state.editingText).toBeNull();
    expect(store.state.currentDocument.shapes[textId]).toMatchObject({
        value: 'Hello',
        parentFrameId: screenId
    });
});

it('edits shared text from any view of the page', () => {
    const { store, screenId, textId } = setup();
    const otherId = store.actions.editFrame({
        kind: 'addView',
        screenId,
        position: { x: 1000, y: 300 },
        size: { width: 300, height: 200 }
    })!;

    expect(doubleClick(store, otherId, { x: 1025, y: 325 })).toBe(true);
    expect(store.state.editingText).toMatchObject({ shapeId: textId, viewId: otherId });
});

it('edits the text of the separate design a view shows, not the base design', () => {
    const { store, viewId, textId } = setup();
    const layoutId = store.actions.editFrame({ kind: 'addLayout', viewId, name: 'Compact' })!;
    store.actions.editFrame({ kind: 'update', id: viewId, changes: { layoutId } });
    const compactId = addText(store, viewId, 'Hi');

    expect(store.state.currentDocument.shapes[compactId]).toMatchObject({
        parentFrameId: layoutId
    });
    expect(doubleClick(store, viewId)).toBe(true);
    expect(store.state.editingText).toMatchObject({ shapeId: compactId, viewId });
    expect(compactId).not.toBe(textId);
});

it('does not edit text through a locked view or with another tool', () => {
    const { store, viewId } = setup();

    store.actions.tools.activateTool('text');
    expect(doubleClick(store, viewId)).toBe(false);
    store.actions.tools.resetTools();

    store.actions.editFrame({ kind: 'toggle', id: viewId, flag: 'locked' });
    expect(doubleClick(store, viewId)).toBe(false);
    expect(store.state.editingText ?? null).toBeNull();
});

it('misses text outside the view it was clicked in', () => {
    const { store, viewId } = setup();

    expect(doubleClick(store, viewId, { x: 780, y: 470 })).toBe(false);
});

it('edits a focused component child through the view it is placed in', () => {
    const { store, viewId, textId, screenId } = setup();
    store.actions.addComponent({ id: 'card', name: 'Card', shapesIds: [textId] });
    store.actions.selectComponentSource('card');
    store.actions.events.setScreenView(viewId);
    store.actions.selectComponentChild({ componentId: 'card', shapeId: textId });

    expect(doubleClick(store, viewId)).toBe(true);
    expect(store.state.editingText).toMatchObject({ shapeId: textId, viewId });
    store.actions.setShapesProperty({ shapeIds: [textId], key: 'text', value: 'Hello' });
    expect(store.state.currentDocument.shapes[textId]).toMatchObject({
        value: 'Hello',
        parentFrameId: screenId
    });
});
