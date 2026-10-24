import { pointerDocument } from 'src/app/screenViewEditing';
import { explorerTree } from 'src/app/explorerTree';
import { json } from 'overmind';
import { createTestStore } from './support/store';
import {
    hydrateDocument,
    migratePersistedState,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { screenSourceShapes, screenViewName } from 'src/app/screenViews';
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
