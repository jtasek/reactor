import { json } from 'overmind';
import { createDocument, createShape } from 'src/app/factories';
import { projectScreen, projectScreenViews } from 'src/app/screenProjection';
import {
    hydrateDocument,
    migratePersistedState,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

const geometry = { position: { x: 100, y: 80 }, size: { width: 300, height: 200 } };

function screenDocument() {
    const shape = createShape({
        type: 'rectangle',
        name: 'Body',
        order: 'a0',
        position: { x: 120, y: 100 },
        size: { width: 40, height: 30 },
        parentFrameId: 'home',
        sizing: { width: { mode: 'fill' } }
    });

    return createDocument({
        id: 'screen-views',
        frames: {
            home: {
                id: 'home',
                name: 'Home',
                kind: 'screen',
                ...geometry,
                stack: { direction: 'column', padding: 10, gap: 0, align: 'start' },
                locked: false,
                visible: true
            }
        },
        shapes: { [shape.id]: shape }
    });
}

it('projects two viewport sizes without duplicating or changing source artwork', () => {
    const document = screenDocument();
    const source = json(document.shapes);
    const compact = projectScreen(document, 'home', geometry)!;
    const wide = projectScreen(document, 'home', {
        position: { x: 600, y: 80 },
        size: { width: 500, height: 200 }
    })!;

    expect(compact.shapes).toHaveLength(1);
    expect(compact.shapes[0]).toMatchObject({
        position: { x: 110, y: 90 },
        size: { width: 280 }
    });
    expect(wide.shapes[0]).toMatchObject({
        position: { x: 610, y: 90 },
        size: { width: 480 }
    });
    expect(document.frames.home.size.width).toBe(300);
    expect(json(document.shapes)).toEqual(source);
});

it('creates and deletes only a view, retaining the destination and its source content', () => {
    const { store } = createTestStore();
    const screenId = store.actions.editFrame({ kind: 'add', ...geometry })!;
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'screen' } });
    const viewId = store.actions.editFrame({
        kind: 'addView',
        screenId,
        position: { x: 500, y: 80 },
        size: { width: 500, height: 200 }
    })!;
    const document = store.state.currentDocument;
    expect(document.frames[viewId]).toMatchObject({ kind: 'view', screenId });
    expect(projectScreen(document, screenId, document.frames[viewId])?.screen.size.width).toBe(500);
    store.actions.editFrame({ kind: 'delete', id: viewId });
    expect(document.frames[viewId]).toBeUndefined();
    expect(document.frames[screenId].kind).toBe('screen');
    const second = store.actions.editFrame({
        kind: 'addView',
        screenId,
        position: { x: 500, y: 80 },
        size: { width: 390, height: 200 }
    })!;
    const cloned = store.actions.editFrame({ kind: 'clone', id: second })!;
    expect(document.frames[cloned]).toMatchObject({ kind: 'view', screenId });
    const other = createTestStore().store;
    expect(
        other.actions.editFrame({
            kind: 'paste',
            frame: json(document.frames[second]),
            target: null
        })
    ).toBeUndefined();
    store.actions.editFrame({ kind: 'delete', id: screenId });
    expect(document.frames[screenId]).toBeUndefined();
    expect(document.frames[second]).toBeUndefined();
    expect(document.frames[cloned]).toBeUndefined();
    expect(
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [
                {
                    op: 'addFrame',
                    key: 'orphan',
                    frame: {
                        kind: 'view',
                        screenId,
                        name: 'Orphan',
                        ...geometry,
                        locked: false,
                        visible: true
                    }
                }
            ]
        }).applied
    ).toBe(false);
});

it('round-trips screen views and preserves explicit screen identity when upgrading v12', () => {
    const document = screenDocument();
    document.frames.wide = {
        id: 'wide',
        kind: 'view',
        screenId: 'home',
        name: 'Home wide',
        position: { x: 500, y: 80 },
        size: { width: 500, height: 200 },
        locked: false,
        visible: true
    };
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = hydrateDocument(migratePersistedState(saved)!.documents[document.id]);
    expect(restored.frames.wide).toMatchObject({ kind: 'view', screenId: 'home' });
    expect(restored.frames.home.kind).toBe('screen');
    const old = { ...saved, version: 12 };
    delete old.documents[document.id].frames.wide;
    expect(migratePersistedState(old)?.documents[document.id].frames.home.kind).toBe('screen');
});

it('bounds the projected artwork across all placed views', () => {
    const document = screenDocument();
    const base = Object.values(document.shapes)[0];
    delete document.frames.home.stack;
    delete base.sizing;

    for (let index = 0; index < 2500; index++) {
        const id = `body-${index}`;
        document.shapes[id] = { ...base, id, order: `b${index}` };
        document.shapesIds.push(id);
    }

    for (const id of ['first', 'second']) {
        document.frames[id] = {
            id,
            kind: 'view',
            screenId: 'home',
            name: id,
            ...geometry,
            visible: true,
            locked: false
        };
    }

    const views = projectScreenViews(document);
    expect(views[0].projection?.shapes).toHaveLength(2501);
    expect(views[1].projection).toBeNull();
    expect(views[1].problem).toContain('5000 projected nodes');
});

it('shares independent view placement and source edits, and undoes only the local view edit', async () => {
    const copies = await createCopies(2, (store) => {
        const id = store.actions.editFrame({ kind: 'add', ...geometry })!;
        store.actions.editFrame({ kind: 'update', id, changes: { kind: 'screen' } });
    });
    const [a, b] = copies;
    const screenId = Object.keys(shownDocument(a).frames)[0];
    let viewId = '';
    edit(a, (actions) => {
        viewId = actions.editFrame({
            kind: 'addView',
            screenId,
            position: { x: 500, y: 80 },
            size: { width: 500, height: 200 }
        })!;
    });
    settle(copies);
    expect(shownDocument(b).frames[viewId].screenId).toBe(screenId);
    a.store.actions.editFrame({ kind: 'select', id: viewId });
    b.store.actions.editFrame({ kind: 'select', id: screenId });
    expect(a.store.state.currentDocument.selectedFrameId).toBe(viewId);
    expect(b.store.state.currentDocument.selectedFrameId).toBe(screenId);
    edit(b, (actions) =>
        actions.editFrame({ kind: 'update', id: screenId, changes: { name: 'Welcome' } })
    );
    settle(copies);
    expect(shownDocument(a).frames[screenId].name).toBe('Welcome');
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(a).frames[viewId]).toBeUndefined();
    expect(shownDocument(b).frames[screenId].name).toBe('Welcome');
});

it('keeps overflowing screen artwork visible with its layout diagnostic', () => {
    const document = screenDocument();
    document.frames.mobile = {
        id: 'mobile',
        kind: 'view',
        screenId: 'home',
        name: 'Mobile',
        ...geometry,
        size: { width: 30, height: 20 },
        visible: true,
        locked: false
    };
    const [view] = projectScreenViews(document);
    expect(view.problem).toContain('overflow');
    expect(view.projection?.shapes).toHaveLength(1);
});

it('keeps local view content independent of placement while tracking layout and artwork changes', () => {
    const { store } = createTestStore();
    const screenId = store.actions.editFrame({ kind: 'add', ...geometry })!;
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
        name: 'Body',
        position: { x: 120, y: 100 },
        size: { width: 40, height: 30 },
        parentFrameId: screenId,
        sizing: { width: { mode: 'fill' } }
    });
    const document = store.state.currentDocument;
    const view = Object.values(document.frames).find((frame) => frame.kind === 'view')!;
    const tree = store.getTrackStateTree();
    const origin = { x: 0, y: 0 };
    tree.trackScope(() => {
        projectScreenViews((tree.state as typeof store.state).currentDocument, {}, origin);
    });
    const dependencies = [...tree.pathDependencies];
    expect(dependencies.some((path) => path.includes(`frames.${view.id}.position`))).toBe(false);
    expect(dependencies.some((path) => path.includes(`frames.${view.id}.size`))).toBe(true);
    const before = json(projectScreenViews(document, {}, origin)[0].projection);
    store.actions.editFrame({
        kind: 'update',
        id: view.id,
        changes: { position: { x: 600, y: 300 } }
    });
    expect(json(projectScreenViews(document, {}, origin)[0].projection)).toEqual(before);
    store.actions.editFrame({
        kind: 'update',
        id: view.id,
        changes: { size: { width: 500, height: 200 } }
    });
    expect(projectScreenViews(document, {}, origin)[0].projection?.shapes[0]).toMatchObject({
        position: { x: 10, y: 10 },
        size: { width: 480 }
    });
});
