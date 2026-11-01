import { snapToGuides } from 'src/app/snapping';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

function setup() {
    const { store } = createTestStore();
    store.actions.addGuide({ id: 'guide', orientation: 'vertical', position: { x: 100, y: 42 } });

    return store;
}

it('edits the active coordinate and transfers it when changing orientation', () => {
    const store = setup();
    store.actions.editGuide({
        id: 'guide',
        kind: 'position',
        orientation: 'vertical',
        value: -12.5
    });
    expect(store.state.currentDocument.guides.guide.position).toEqual({ x: -12.5, y: 42 });
    store.actions.editGuide({ id: 'guide', kind: 'orientation', value: 'horizontal' });
    expect(store.state.currentDocument.guides.guide.position).toEqual({ x: -12.5, y: -12.5 });
    expect(
        snapToGuides({ x: 20, y: -10 }, Object.values(store.state.currentDocument.guides), 6)
    ).toEqual({ x: 20, y: -12.5 });
});

it('rejects invalid and stale coordinates and protects locked or actively dragged guides', () => {
    const store = setup();
    for (const value of [NaN, Infinity, -Infinity]) {
        store.actions.editGuide({ id: 'guide', kind: 'position', orientation: 'vertical', value });
    }
    store.actions.editGuide({
        id: 'guide',
        kind: 'position',
        orientation: 'horizontal',
        value: 50
    });
    store.actions.setGuideDragActive(true);
    store.actions.editGuide({ id: 'guide', kind: 'orientation', value: 'horizontal' });
    store.actions.setGuideDragActive(false);
    store.actions.editGuide({ id: 'guide', kind: 'locked', value: true });
    store.actions.editGuide({ id: 'guide', kind: 'position', orientation: 'vertical', value: 50 });
    store.actions.editGuide({ id: 'guide', kind: 'delete' });
    expect(store.state.currentDocument.guides.guide).toMatchObject({
        orientation: 'vertical',
        position: { x: 100, y: 42 },
        locked: true
    });
    store.actions.editGuide({ id: 'guide', kind: 'locked', value: false });
    store.actions.editGuide({ id: 'guide', kind: 'position', orientation: 'vertical', value: 50 });
    expect(store.state.currentDocument.guides.guide.position.x).toBe(50);
});

it('shares Inspector edits and undoes them independently without undoing another author', async () => {
    const copies = await createCopies(
        2,
        (store) => {
            store.actions.addGuide({
                id: 'guide',
                orientation: 'vertical',
                position: { x: 100, y: 42 }
            });
        },
        500
    );
    const [a, b] = copies;
    edit(a, (actions) =>
        actions.editGuide({ id: 'guide', kind: 'position', orientation: 'vertical', value: 125.5 })
    );
    settle(copies);
    edit(a, (actions) =>
        actions.editGuide({ id: 'guide', kind: 'orientation', value: 'horizontal' })
    );
    settle(copies);
    edit(b, (actions) => actions.editGuide({ id: 'guide', kind: 'name', value: 'Baseline' }));
    settle(copies);
    expect(shownDocument(b).guides.guide).toMatchObject({
        orientation: 'horizontal',
        position: { x: 125.5, y: 125.5 }
    });
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).guides.guide).toMatchObject({
        name: 'Baseline',
        orientation: 'vertical',
        position: { x: 125.5, y: 42 }
    });
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).guides.guide.position.x).toBe(100);
    a.collaboration.redo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).guides.guide.position.x).toBe(125.5);
    copies.forEach(({ collaboration }) => collaboration.close(DOCUMENT_ID));
});

it.each(['viewer', 'document', 'gesture'] as const)(
    'prevents Inspector edits while protected by %s',
    (protection) => {
        const store = setup();
        if (protection === 'viewer') {
            store.actions.setDocumentAccess({
                [store.state.currentDocumentId]: { role: 'viewer' }
            });
        }
        if (protection === 'document') {
            store.actions.lockDocument(store.state.currentDocumentId);
        }
        if (protection === 'gesture') {
            store.actions.events.beginGesture({ pointerId: 1, position: { x: 500, y: 500 } });
        }
        store.actions.editGuide({
            id: 'guide',
            kind: 'position',
            orientation: 'vertical',
            value: 30
        });
        store.actions.editGuide({ id: 'guide', kind: 'locked', value: true });
        store.actions.editGuide({ id: 'guide', kind: 'delete' });
        expect(store.state.currentDocument.guides.guide).toMatchObject({
            position: { x: 100, y: 42 },
            locked: false
        });
    }
);
