import { renderedFrame, renderedShape } from 'src/app/frameLayout';
import { creationTarget } from 'src/ui/components/CommandLine/creationTarget';
import { creationOperation } from 'src/ui/components/CommandLine/creation';
import { projectScreenViews } from 'src/app/screenProjection';
import { createTestStore } from './support/store';

const canvas = { x: 999, y: 999 };

function setup() {
    const { store } = createTestStore();
    const frameId = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 80 },
        size: { width: 300, height: 200 }
    })!;
    const create = (text: string) => {
        const target = creationTarget(store.state, canvas);
        const operation = creationOperation(text, target.center, target)!;
        const result = store.actions.applyOperations({
            documentId: store.state.currentDocumentId,
            by: { kind: 'person' },
            operations: [operation]
        });
        expect(result.applied).toBe(true);

        return store.state.currentDocument.shapes[store.state.currentDocument.shapesIds.at(-1)!];
    };

    return { store, frameId, create };
}

it('centers in a frame and interprets explicit coordinates relative to its origin', () => {
    const { frameId, create } = setup();
    expect(create('rectangle w=40 h=20')).toMatchObject({
        parentFrameId: frameId,
        position: { x: 230, y: 170 }
    });
    expect(create('circle r=12 x=-5 y=20')).toMatchObject({
        parentFrameId: frameId,
        position: { x: 95, y: 100 }
    });
    expect(create('text text="Label" fs=18 x=12 y=30')).toMatchObject({
        parentFrameId: frameId,
        position: { x: 112, y: 110 },
        value: 'Label'
    });
});

it('uses resized view dimensions but persists membership and coordinates in its source', () => {
    const { store, frameId, create } = setup();
    store.actions.editFrame({ kind: 'update', id: frameId, changes: { kind: 'screen' } });
    const viewId = store.actions.editFrame({
        kind: 'addView',
        screenId: frameId,
        position: { x: 600, y: 400 },
        size: { width: 500, height: 250 }
    })!;
    const shape = create('rectangle w=40 h=20');
    expect(shape).toMatchObject({ parentFrameId: frameId, position: { x: 330, y: 195 } });
    expect(
        projectScreenViews(store.state.currentDocument)
            .find(({ view }) => view.id === viewId)
            ?.projection?.shapes.find(({ id }) => id === shape.id)
    ).toMatchObject({ position: { x: 830, y: 515 } });
});

it('uses explicit and automatically selected alternate layouts', () => {
    const { store, frameId, create } = setup();
    store.actions.editFrame({ kind: 'update', id: frameId, changes: { kind: 'screen' } });
    const viewId = store.actions.editFrame({
        kind: 'addView',
        screenId: frameId,
        position: { x: 600, y: 400 },
        size: { width: 700, height: 300 }
    })!;
    const layoutId = store.actions.editFrame({ kind: 'addLayout', viewId, name: 'Wide' })!;
    expect(create('circle r=10 x=20 y=30').parentFrameId).toBe(layoutId);
    store.actions.editFrame({
        kind: 'update',
        id: frameId,
        changes: { responsiveLayouts: { wide: { minWidth: 600, layoutId } } }
    });
    store.actions.editFrame({
        kind: 'update',
        id: viewId,
        changes: { layoutMode: 'auto', layoutId: null }
    });
    store.actions.editFrame({ kind: 'select', id: viewId });
    expect(create('circle r=10').parentFrameId).toBe(layoutId);
    store.actions.editFrame({
        kind: 'update',
        id: viewId,
        changes: { size: { width: 400, height: 300 } }
    });
    expect(create('circle r=10').parentFrameId).toBe(frameId);
});

it('refuses a locked selected frame instead of creating on the canvas', () => {
    const { store, frameId } = setup();
    store.actions.editFrame({ kind: 'toggle', id: frameId, flag: 'locked' });
    store.actions.editFrame({ kind: 'select', id: frameId });
    expect(() => creationTarget(store.state, canvas)).toThrow('locked');
    expect(store.state.currentDocument.shapesIds).toHaveLength(0);
});

it('keeps local coordinates inside a nested frame positioned by a parent stack', () => {
    const { store, frameId, create } = setup();
    const parent = store.actions.editFrame({
        kind: 'add',
        position: { x: 500, y: 400 },
        size: { width: 700, height: 500 }
    })!;
    store.actions.editFrame({
        kind: 'update',
        id: parent,
        changes: { stack: { direction: 'column', padding: 20, gap: 12, align: 'start' } }
    });
    store.actions.editFrame({ kind: 'update', id: frameId, changes: { parentFrameId: parent } });
    store.actions.editFrame({ kind: 'select', id: frameId });
    const shape = create('rectangle w=40 h=20 x=12 y=30');
    const document = store.state.currentDocument;
    const frame = renderedFrame(document, frameId);
    expect(renderedShape(document, shape.id)).toMatchObject({
        position: {
            x: frame.position.x + 12,
            y: frame.position.y + 30
        }
    });
});

it('lets a stack position its newly created children', () => {
    const { store, frameId, create } = setup();
    store.actions.editFrame({
        kind: 'update',
        id: frameId,
        changes: { stack: { direction: 'column', padding: 10, gap: 8, align: 'start' } }
    });
    const first = create('rectangle w=40 h=20');
    const second = create('rectangle w=40 h=20');
    expect(renderedShape(store.state.currentDocument, first.id)).toMatchObject({
        position: { x: 110, y: 90 }
    });
    expect(renderedShape(store.state.currentDocument, second.id)).toMatchObject({
        position: { x: 110, y: 118 }
    });
});

it('refuses creation through a view when its shared screen is locked', () => {
    const { store, frameId } = setup();
    store.actions.editFrame({ kind: 'update', id: frameId, changes: { kind: 'screen' } });
    const viewId = store.actions.editFrame({
        kind: 'addView',
        screenId: frameId,
        position: { x: 600, y: 400 },
        size: { width: 500, height: 250 }
    })!;
    store.actions.editFrame({ kind: 'toggle', id: frameId, flag: 'locked' });
    store.actions.editFrame({ kind: 'select', id: viewId });
    expect(() => creationTarget(store.state, canvas)).toThrow('cannot be edited');
    expect(store.state.currentDocument.shapesIds).toHaveLength(0);
});

it('refuses a selected child whose ancestor is hidden', () => {
    const { store, frameId } = setup();
    const parent = store.actions.editFrame({
        kind: 'add',
        position: { x: 0, y: 0 },
        size: { width: 700, height: 500 }
    })!;
    store.actions.editFrame({ kind: 'update', id: frameId, changes: { parentFrameId: parent } });
    store.actions.editFrame({ kind: 'toggle', id: parent, flag: 'visible' });
    store.actions.editFrame({ kind: 'select', id: frameId });
    expect(() => creationTarget(store.state, canvas)).toThrow('hidden');
    expect(store.state.currentDocument.shapesIds).toHaveLength(0);
});
