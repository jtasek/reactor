import * as Y from 'yjs';
import { json } from 'overmind';
import { previewFixture } from './support/preview';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import {
    hydrateDocument,
    migratePersistedState,
    readEntity,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { writeClipboard } from 'src/app/frameEdits';
import { screenFrames } from 'src/app/screens';
import { projectPreview } from 'src/preview/project';

const geometry = { position: { x: 100, y: 80 }, size: { width: 300, height: 200 } };

function legacyDocument() {
    const document = previewFixture();
    document.frames.card = {
        ...document.frames.home,
        id: 'card',
        name: 'Card',
        parentFrameId: 'home'
    };
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    Object.values(saved.documents[document.id].frames).forEach((frame) => {
        delete frame.kind;
    });

    return { saved: { ...saved, version: 11 }, id: document.id };
}

it('migrates legacy roots without changing artwork, geometry or navigation IDs, then round-trips explicit identity', () => {
    const { saved, id } = legacyDocument();
    const migrated = migratePersistedState(saved)!;
    const data = migrated.documents[id];
    expect(data.frames.home.kind).toBe('screen');
    expect(data.frames.details.kind).toBe('screen');
    expect(data.frames.card.kind).toBe('frame');
    expect(data.shapes).toEqual(saved.documents[id].shapes);
    expect(data.frames.home.position).toEqual(saved.documents[id].frames.home.position);
    expect(data.components.button.interaction?.navigateTo).toBe('details');
    const document = hydrateDocument(data);
    expect(projectPreview(document, {}).screens.map((screen) => screen.id)).toEqual([
        'home',
        'details'
    ]);
    document.frames.details.kind = 'frame';
    const current = serializePersistedState({
        currentDocumentId: id,
        documents: { [id]: document }
    });
    expect(migratePersistedState(current)?.documents[id].frames.details.kind).toBe('frame');
});

it('creates ordinary frames, converts in place, and copies screen identity without changing the original', () => {
    const { store } = createTestStore();
    const id = store.actions.editFrame({ kind: 'add', ...geometry })!;
    const document = store.state.currentDocument;
    expect(document.frames[id].kind).toBe('frame');
    store.actions.addShape({ type: 'rectangle', ...geometry, parentFrameId: id });
    const before = json(document.shapes);
    store.actions.editFrame({ kind: 'update', id, changes: { kind: 'screen', name: 'Home' } });
    expect(document.frames[id]).toMatchObject({ id, kind: 'screen', ...geometry });
    expect(json(document.shapes)).toEqual(before);
    const clipboard = writeClipboard(json(document.frames[id]), document);
    store.actions.pasteShapes(clipboard);
    const copied = Object.values(document.frames).find((frame) => frame.id !== id)!;
    expect(copied.kind).toBe('screen');
    expect(screenFrames(document)).toHaveLength(2);
    expect(Object.values(document.shapes).some((shape) => shape.parentFrameId === copied.id)).toBe(
        true
    );
});

it('keeps authored targets through demotion, nesting, rename and deletion instead of redirecting them', () => {
    const document = previewFixture();
    document.frames.details.kind = 'frame';
    const warnings: string[] = [];
    const output = projectPreview(document, {}, warnings);
    expect(output.screens.map((screen) => screen.id)).toEqual(['home']);
    expect(warnings[0]).toContain('unavailable screen');
    expect(document.components.button.interaction?.navigateTo).toBe('details');
    document.frames.details.kind = 'screen';
    document.frames.details.parentFrameId = 'home';
    expect(screenFrames(document).map((frame) => frame.id)).toEqual(['home']);
    expect(document.frames.details.kind).toBe('screen');
    delete document.frames.details.parentFrameId;
    document.frames.details.name = 'Renamed';
    expect(projectPreview(document, {}).screens[1]).toMatchObject({
        id: 'details',
        name: 'Renamed'
    });
    delete document.frames.details;
    expect(document.components.button.interaction?.navigateTo).toBe('details');
});

it('shares conversion independently of geometry edits and undoes only the local designation', async () => {
    const copies = await createCopies(2, (store) => {
        store.actions.editFrame({ kind: 'add', ...geometry });
    });
    const [a, b] = copies;
    const id = Object.keys(shownDocument(a).frames)[0];
    edit(a, (actions) => actions.editFrame({ kind: 'update', id, changes: { kind: 'screen' } }));
    edit(b, (actions) =>
        actions.editFrame({
            kind: 'update',
            id,
            changes: { name: 'Home', position: { x: 500, y: 80 } }
        })
    );
    settle(copies);
    expect(shownDocument(b).frames[id]).toMatchObject({
        kind: 'screen',
        name: 'Home',
        position: { x: 500, y: 80 }
    });
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).frames[id]).toMatchObject({
        kind: 'frame',
        name: 'Home',
        position: { x: 500, y: 80 }
    });
    a.collaboration.redo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).frames[id].kind).toBe('screen');
    edit(a, (actions) => actions.editFrame({ kind: 'update', id, changes: { kind: 'frame' } }));
    edit(b, (actions) => actions.editFrame({ kind: 'delete', id }));
    settle(copies);
    expect(shownDocument(a).frames[id]).toBeUndefined();
    expect(shownDocument(b).frames[id]).toBeUndefined();
});

it('upgrades legacy shared frames on open and receive, without promoting an explicitly ordinary frame', async () => {
    const [copy] = await createCopies(1);
    const old = new Y.Doc();
    Y.applyUpdate(old, copy.collaboration.state(DOCUMENT_ID));
    const frames = old.getMap<Y.Map<unknown>>('frames');
    const put = (id: string, parentFrameId?: string, kind?: 'frame') => {
        const value = new Y.Map<unknown>();
        frames.set(id, value);
        Object.entries({
            id,
            name: id,
            ...geometry,
            visible: true,
            locked: false,
            ...(parentFrameId ? { parentFrameId } : {}),
            ...(kind ? { kind } : {})
        }).forEach(([key, field]) => value.set(key, field));
    };
    old.transact(() => {
        put('home');
        put('card', 'home');
        put('ordinary', undefined, 'frame');
    });
    copy.collaboration.close(DOCUMENT_ID);
    copy.collaboration.open(DOCUMENT_ID, Y.encodeStateAsUpdate(old));
    expect(shownDocument(copy).frames.home.kind).toBe('screen');
    expect(shownDocument(copy).frames.card.kind).toBe('frame');
    expect(shownDocument(copy).frames.ordinary.kind).toBe('frame');
    expect(shownDocument(copy).history.canUndo).toBe(false);
    copy.collaboration.undo(DOCUMENT_ID);
    expect(shownDocument(copy).frames.home.kind).toBe('screen');
    Y.applyUpdate(old, copy.collaboration.state(DOCUMENT_ID));
    old.transact(() => put('later'));
    copy.collaboration.receive(DOCUMENT_ID, Y.encodeStateAsUpdate(old));
    expect(shownDocument(copy).frames.later.kind).toBe('screen');
    old.destroy();
});

it('rejects malformed screen identity without dropping a valid frame', () => {
    expect(() =>
        readEntity('frames', {
            id: 'x',
            name: 'X',
            ...geometry,
            visible: true,
            locked: false,
            kind: 'page'
        })
    ).toThrow('identity');
});
