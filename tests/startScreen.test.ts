import { startScreen } from 'src/app/screens';
import {
    migratePersistedState,
    restoreDocuments,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { previewFixture } from './support/preview';
import { createCopies, DOCUMENT_ID, edit, settle, shownDocument } from './support/collaboration';

const setup = (store: Parameters<NonNullable<Parameters<typeof createCopies>[1]>>[0]) => {
    const document = previewFixture();
    document.id = DOCUMENT_ID;
    store.actions.addDocument(document);
};

it('starts on the first Screen until one is chosen, and saves the choice', () => {
    const document = previewFixture();
    expect(startScreen(document)?.id).toBe('home');
    document.frames.details.start = true;
    expect(startScreen(document)?.id).toBe('details');
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = restoreDocuments(migratePersistedState(saved)!)[document.id];
    expect(startScreen(restored)?.id).toBe('details');
    // A document saved before start screens existed opens on its first Screen.
    delete saved.documents[document.id].frames.details.start;
    expect(
        startScreen(
            restoreDocuments(migratePersistedState({ ...saved, version: 30 })!)[document.id]
        )?.id
    ).toBe('home');
});

it('shares the start screen, moves it in one undo step and gives it up with its Screen', async () => {
    const copies = await createCopies(2, setup);
    const [a, b] = copies;
    edit(a, (actions) =>
        expect(actions.editFrame({ kind: 'start', id: 'details' })).toBe('details')
    );
    settle(copies);
    expect(startScreen(shownDocument(b))?.id).toBe('details');
    edit(a, (actions) => actions.editFrame({ kind: 'start', id: 'home' }));
    settle(copies);
    expect(shownDocument(b).frames.details.start).toBeUndefined();
    expect(startScreen(shownDocument(b))?.id).toBe('home');
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(startScreen(shownDocument(b))?.id).toBe('details');
    expect(shownDocument(b).frames.home.start).toBeUndefined();
    // A hidden Screen is not a destination, and one that stops being a Screen drops the mark.
    edit(a, (actions) => actions.editFrame({ kind: 'toggle', id: 'details', flag: 'visible' }));
    expect(startScreen(shownDocument(a))?.id).toBe('home');
    edit(a, (actions) => actions.editFrame({ kind: 'toggle', id: 'details', flag: 'visible' }));
    edit(a, (actions) => actions.editFrame({ kind: 'delete', id: 'details' }));
    settle(copies);
    expect(startScreen(shownDocument(b))?.id).toBe('home');
});

it('settles on one start when two copies choose at once, and refuses non-Screens', async () => {
    const copies = await createCopies(2, setup);
    const [a, b] = copies;
    edit(a, (actions) => actions.editFrame({ kind: 'start', id: 'details' }));
    edit(b, (actions) => actions.editFrame({ kind: 'start', id: 'home' }));
    settle(copies);
    expect(startScreen(shownDocument(a))?.id).toBe(startScreen(shownDocument(b))?.id);
    edit(a, (actions) =>
        expect(actions.editFrame({ kind: 'start', id: 'missing' })).toBeUndefined()
    );
    expect(
        a.store.actions.applyOperations({
            documentId: DOCUMENT_ID,
            by: { kind: 'person' },
            operations: [{ op: 'updateFrame', frame: 'home', changes: { kind: 'frame' } }]
        }).applied
    ).toBe(true);
    expect(shownDocument(a).frames.home.start).toBeUndefined();
});
