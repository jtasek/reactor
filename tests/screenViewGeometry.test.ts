import { componentScreenViews } from 'src/app/screenViewEditing';
import { projectScreenViews } from 'src/app/screenProjection';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';

function setup() {
    const { store } = createTestStore();
    const screenId = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 80 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({
        kind: 'update',
        id: screenId,
        changes: {
            kind: 'screen',
            stack: { direction: 'column', padding: 10, gap: 0, align: 'start' }
        }
    });
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 120, y: 100 },
        size: { width: 40, height: 30 },
        parentFrameId: screenId,
        sizing: { width: { mode: 'fill' } }
    });
    const document = store.state.currentDocument;
    const shapeId = document.shapesIds[0];
    const viewId = Object.values(document.frames).find((frame) => frame.kind === 'view')!.id;

    return { store, document, shapeId, viewId };
}

it('reuses geometry through selection, hover and view placement, with live hit-test selection', () => {
    const { store, document, shapeId, viewId } = setup();
    const before = document.screenViewGeometry;
    store.actions.selectShape(shapeId);
    store.actions.activateShape(shapeId);
    expect(document.screenViewGeometry).toBe(before);
    expect(componentScreenViews(store.state)[0].projection?.shapes[0].selected).toBe(true);
    store.actions.unselectShapes();
    expect(componentScreenViews(store.state)[0].projection?.shapes[0].selected).toBe(false);
    store.actions.editFrame({
        kind: 'update',
        id: viewId,
        changes: { position: { x: 700, y: 400 } }
    });
    expect(document.screenViewGeometry).toBe(before);
    expect(componentScreenViews(store.state)[0].projection?.shapes[0]).toMatchObject({
        position: { x: 710, y: 410 }
    });
});

it('replays nested dependencies to successive cache readers and invalidates authored edits', () => {
    const { store, document, shapeId, viewId } = setup();
    const before = document.screenViewGeometry;
    const trees = [store.getTrackStateTree(), store.getTrackStateTree()];
    for (const tree of trees) {
        tree.trackScope(() => {
            const state = tree.state as typeof store.state;
            expect(state.currentDocument.screenViewGeometry).toBe(before);
        });
        const paths = [...tree.pathDependencies];
        expect(paths).toContain(`documents.${document.id}.shapes.${shapeId}.size.height`);
        expect(paths.some((path) => path.endsWith('.selected') || path.endsWith('.active'))).toBe(
            false
        );
        expect(paths.some((path) => path.includes(`frames.${viewId}.position`))).toBe(false);
    }
    store.actions.updateShape({ id: shapeId, size: { width: 40, height: 70 } });
    expect(document.screenViewGeometry).not.toBe(before);
    expect(document.screenViewGeometry[0].projection?.shapes[0]).toMatchObject({
        size: { height: 70 }
    });
    store.actions.editFrame({
        kind: 'update',
        id: viewId,
        changes: { size: { width: 500, height: 200 } }
    });
    expect(document.screenViewGeometry[0].projection?.shapes[0]).toMatchObject({
        size: { width: 480 }
    });
});

it('matches uncached projection geometry and keeps cache out of saved documents', () => {
    const { store, document } = setup();
    const plain = projectScreenViews(document, {}, { x: 0, y: 0 });
    const cached = document.screenViewGeometry;
    expect(
        cached[0].projection?.shapes.map((shape) =>
            Object.fromEntries(
                Object.entries(shape).filter(([key]) => key !== 'selected' && key !== 'active')
            )
        )
    ).toEqual(
        plain[0].projection?.shapes.map((shape) =>
            Object.fromEntries(
                Object.entries(shape).filter(([key]) => key !== 'selected' && key !== 'active')
            )
        )
    );
    expect(JSON.stringify(serializePersistedState(store.state))).not.toContain(
        'screenViewGeometry'
    );
});
