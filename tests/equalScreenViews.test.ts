import { pointerDocument } from 'src/app/screenViewEditing';
import { explorerTree } from 'src/app/explorerTree';
import { json } from 'overmind';
import { createTestStore } from './support/store';
import {
    hydrateDocument,
    migratePersistedState,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { screenOwners, screenSourceShapes, screenViewName } from 'src/app/screenViews';
import { projectScreenViews } from 'src/app/screenProjection';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

function setup(store = createTestStore().store) {
    const screenId = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 80 },
        size: { width: 390, height: 844 }
    })!;
    store.actions.editFrame({
        kind: 'update',
        id: screenId,
        changes: { name: 'Home', kind: 'screen' }
    });
    const mobileId = Object.values(store.state.currentDocument.frames).find(
        (frame) => frame.kind === 'view'
    )!.id;
    store.actions.editFrame({ kind: 'update', id: mobileId, changes: { name: 'Mobile' } });
    const desktopId = store.actions.editFrame({
        kind: 'addView',
        screenId,
        name: 'Desktop',
        position: { x: 600, y: 80 },
        size: { width: 1440, height: 900 }
    })!;
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 120, y: 100 },
        size: { width: 40, height: 30 },
        parentFrameId: screenId
    });

    return { store, screenId, mobileId, desktopId };
}

it('creates two equal placements with independent names and viewports and a stable screen destination', () => {
    const { store, screenId, mobileId, desktopId } = setup();
    const document = store.state.currentDocument;
    const source = json(document.shapes);
    expect(document.frames[screenId].definitionOnly).toBe(true);
    expect(document.frames[mobileId]).toMatchObject({ kind: 'view', screenId });
    expect(document.frames[desktopId]).toMatchObject({ kind: 'view', screenId });
    expect(screenViewName(document, document.frames[mobileId])).toBe('Home · Mobile');
    expect(screenViewName(document, document.frames[desktopId])).toBe('Home · Desktop');
    store.actions.editFrame({
        kind: 'update',
        id: mobileId,
        changes: { position: { x: 200, y: 300 }, size: { width: 430, height: 932 } }
    });
    expect(document.frames[desktopId]).toMatchObject({
        position: { x: 600, y: 80 },
        size: { width: 1440, height: 900 }
    });
    expect(json(document.shapes)).toEqual(source);
    expect(document.frames[screenId]).toMatchObject({
        position: { x: 100, y: 80 },
        size: { width: 390, height: 844 }
    });
    expect(screenSourceShapes(document)).toEqual(new Set(document.shapesIds));
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { name: 'Start' } });
    expect(screenViewName(document, document.frames[mobileId])).toBe('Start · Mobile');
    expect(screenViewName(document, document.frames[desktopId])).toBe('Start · Desktop');
});

it('deletes every view without deleting or resurrecting the screen or its artwork, then places it again', () => {
    const { store, screenId, mobileId, desktopId } = setup();
    const document = store.state.currentDocument;
    store.actions.editFrame({ kind: 'delete', id: mobileId });
    store.actions.editFrame({ kind: 'delete', id: desktopId });
    expect(document.frames[screenId].kind).toBe('screen');
    expect(document.shapesIds).toHaveLength(1);
    expect(projectScreenViews(document)).toHaveLength(0);
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = hydrateDocument(migratePersistedState(saved)!.documents[document.id]);
    expect(Object.values(restored.frames).filter((frame) => frame.kind === 'view')).toHaveLength(0);
    const placed = store.actions.editFrame({
        kind: 'addView',
        screenId,
        position: { x: 400, y: 100 },
        size: { width: 390, height: 844 }
    })!;
    expect(projectScreenViews(document)[0].projection?.shapes).toHaveLength(1);
    expect(screenViewName(document, document.frames[placed])).toBe('Home · 390 px');
});

it('migrates a legacy hybrid placement once while retaining navigation identity and the other views', () => {
    const { store, screenId, desktopId, mobileId } = setup();
    const document = store.state.currentDocument;
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const legacy = { ...saved, version: 13 };
    delete legacy.documents[document.id].frames[screenId].definitionOnly;
    delete legacy.documents[document.id].frames[mobileId];
    legacy.documents[document.id].frames[desktopId].name = 'Home · Desktop';
    const migrated = migratePersistedState(legacy)!.documents[document.id];
    expect(migrated.frames[screenId]).toMatchObject({
        id: screenId,
        kind: 'screen',
        definitionOnly: true
    });
    const views = Object.values(migrated.frames).filter((frame) => frame.kind === 'view');
    expect(views).toHaveLength(2);
    expect(migrated.frames[desktopId].name).toBe('Desktop');
    expect(migrated.shapes).toEqual(saved.documents[document.id].shapes);
    const again = hydrateDocument(migrated);
    expect(Object.values(again.frames).filter((frame) => frame.kind === 'view')).toHaveLength(2);
});

it('shares deletion of the initial placement and undoes it without replacing the screen', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const document = shownDocument(a);
    const mobile = Object.values(document.frames).find(
        (frame) => frame.kind === 'view' && frame.name === 'Mobile'
    )!;
    edit(a, (actions) => actions.editFrame({ kind: 'delete', id: mobile.id }));
    settle(copies);
    expect(shownDocument(b).frames[mobile.id]).toBeUndefined();
    expect(shownDocument(b).frames[mobile.screenId!].definitionOnly).toBe(true);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).frames[mobile.id]).toMatchObject({
        kind: 'view',
        screenId: mobile.screenId
    });
});

it('reuses existing views when a screen is demoted and promoted again', () => {
    const { store, screenId, mobileId, desktopId } = setup();
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'frame' } });
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'screen' } });
    expect(
        Object.values(store.state.currentDocument.frames)
            .filter((frame) => frame.kind === 'view')
            .map((frame) => frame.id)
            .sort()
    ).toEqual([mobileId, desktopId].sort());
});

it('keeps matching shared artwork discoverable under each view', () => {
    const { store, mobileId, desktopId } = setup();
    const document = store.state.currentDocument;
    store.actions.selectShape(document.shapesIds[0]);
    store.actions.setShapesProperty({
        shapeIds: [document.shapesIds[0]],
        key: 'name',
        value: 'Logo'
    });
    const tree = explorerTree(document, 'Logo');
    expect(tree.frames.map((frame) => frame.id)).toEqual(
        expect.arrayContaining([mobileId, desktopId])
    );
    const mobile = explorerTree(document, 'Home · Mobile');
    expect(mobile.frames.flatMap((frame) => frame.contents.shapesIds)).toContain(
        document.shapesIds[0]
    );
});

it('does not hit shared artwork or group boxes at hidden source coordinates', () => {
    const { store } = setup();
    const document = store.state.currentDocument;
    store.actions.addGroup({
        id: 'source-group',
        name: 'Source group',
        shapesIds: [...document.shapesIds]
    });
    const canvas = pointerDocument(store.state);
    expect(canvas.shapesIds).toHaveLength(0);
    expect(canvas.shapes[document.shapesIds[0]]).toBeUndefined();
    expect(canvas.groupFrames['source-group']).toBeUndefined();
});

it('reuses ordinary canvas geometry when there is no shared screen artwork', () => {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 10 },
        size: { width: 40, height: 30 }
    });
    expect(pointerDocument(store.state)).toBe(store.state.currentDocument);
});

it('keeps a deleted screen’s artwork where its first view shows it, in one undo step', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const document = shownDocument(a);
    const screen = Object.values(document.frames).find((frame) => frame.kind === 'screen')!;
    const mobile = Object.values(document.frames).find((frame) => frame.name === 'Mobile')!;
    const [shapeId] = document.shapesIds;
    edit(a, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: mobile.id,
            changes: { position: { x: 2000, y: 1500 } }
        })
    );
    edit(a, (actions) => actions.editFrame({ kind: 'delete', id: screen.id }));
    settle(copies);
    expect(Object.keys(shownDocument(b).frames)).toHaveLength(0);
    // The rectangle sat 20, 20 inside the screen, so it stays 20, 20 inside the view.
    expect(shownDocument(b).shapes[shapeId]).toMatchObject({ position: { x: 2020, y: 1520 } });
    expect(shownDocument(b).shapes[shapeId].parentFrameId).toBeUndefined();
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).frames[screen.id]).toMatchObject({ position: { x: 100, y: 80 } });
    expect(shownDocument(b).shapes[shapeId]).toMatchObject({
        position: { x: 120, y: 100 },
        parentFrameId: screen.id
    });
});

function nestedFrame(store = createTestStore().store) {
    const parentId = store.actions.editFrame({
        kind: 'add',
        position: { x: 0, y: 0 },
        size: { width: 800, height: 800 }
    })!;
    const childId = store.actions.editFrame({
        kind: 'add',
        position: { x: 300, y: 300 },
        size: { width: 200, height: 200 }
    })!;
    store.actions.editFrame({ kind: 'update', id: childId, changes: { parentFrameId: parentId } });

    return { store, parentId, childId };
}

const views = (frames: Record<string, { kind?: string }>) =>
    Object.values(frames).filter((frame) => frame.kind === 'view');

it('draws a nested screen in place and gives it a view only once it moves to Canvas', () => {
    const { store, childId } = nestedFrame();
    const document = store.state.currentDocument;
    store.actions.editFrame({ kind: 'update', id: childId, changes: { kind: 'screen' } });
    expect(document.frames[childId].kind).toBe('screen');
    expect(views(document.frames)).toHaveLength(0);
    expect(screenOwners(document.frames).get(childId)).toBeUndefined();
    store.actions.editFrame({ kind: 'update', id: childId, changes: { parentFrameId: null } });
    expect(document.frames[childId].definitionOnly).toBe(true);
    expect(views(document.frames)).toEqual([
        expect.objectContaining({ screenId: childId, position: { x: 300, y: 300 } })
    ]);
    expect(screenOwners(document.frames).get(childId)).toBe(childId);
});

it('leaves legacy nested screens in their parent frame on upgrade', () => {
    const { store, childId } = nestedFrame();
    const document = store.state.currentDocument;
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const legacy = { ...saved, version: 13 };
    legacy.documents[document.id].frames[childId].kind = 'screen';
    const migrated = migratePersistedState(legacy)!.documents[document.id];
    expect(migrated.frames[childId].kind).toBe('screen');
    expect(migrated.frames[childId].definitionOnly).toBeUndefined();
    expect(views(migrated.frames)).toHaveLength(0);
});

it('leaves a shared nested screen in its parent frame when another copy opens it', async () => {
    const copies = await createCopies(2, (store) => {
        const { childId } = nestedFrame(store);
        store.actions.editFrame({ kind: 'update', id: childId, changes: { kind: 'screen' } });
    });
    settle(copies);
    copies.forEach((copy) => expect(views(shownDocument(copy).frames)).toHaveLength(0));
});
