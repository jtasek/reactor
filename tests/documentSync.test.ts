import { IDBFactory } from 'fake-indexeddb';
import { createDocument, createShape } from 'src/app/factories';
import { DocumentDatabase } from 'src/app/services/documentDatabase';
import { PERSISTENCE_KEY, serializePersistedState } from 'src/app/services/documentStorage';
import type { Channel } from 'src/app/services/tabSync';
import { Hub } from './support/channel';
import { createTestStore } from './support/store';

const rectangle = {
    type: 'rectangle' as const,
    position: { x: 0, y: 0 },
    size: { width: 20, height: 10 }
};

/** A local storage save of one document, `saved`, holding one rectangle. */
function localSave() {
    const document = createDocument({ id: 'saved', name: 'Saved drawing' });
    const shape = createShape({ ...rectangle, order: 'a0' });

    document.shapes[shape.id] = shape;

    return JSON.stringify(
        serializePersistedState({ currentDocumentId: 'saved', documents: { saved: document } })
    );
}

/** Starts a copy of the editor on a device whose IndexedDB is `indexedDB`. */
async function start(
    indexedDB: IDBFactory,
    options: { seed?: Record<string, string>; autoSave?: boolean; hub?: Hub } = {}
) {
    const { hub } = options;
    let channel: Channel | undefined;
    const test = createTestStore(options.seed, {
        autoSave: options.autoSave ?? true,
        indexedDB,
        openChannel: hub && (() => (channel = hub.open()))
    });

    await test.store.onInitialize();

    return { ...test, channel };
}

/** The database as another copy reads it, after the writes asked for so far. */
const database = (indexedDB: IDBFactory) => DocumentDatabase.open(indexedDB);

const messages = ({ store }: { store: ReturnType<typeof createTestStore>['store'] }) =>
    store.state.notifications.map(({ message }) => message);

describe('document sync', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('moves the local storage save into the database once, backed up first', async () => {
        const indexedDB = new IDBFactory();
        const original = localSave();
        const first = await start(indexedDB, { seed: { [PERSISTENCE_KEY]: original } });

        expect(Object.keys(first.store.state.documents)).toEqual(['saved']);
        expect(first.storage.get(`${PERSISTENCE_KEY}:backup`)).toBe(original);
        expect(first.storage.get(PERSISTENCE_KEY)).toBe(original);
        expect(first.store.state.loading).toBe(false);

        const later = await start(indexedDB, { seed: { [PERSISTENCE_KEY]: '{unread' } });

        expect(later.store.state.documents.saved.name).toBe('Saved drawing');
        expect(Object.keys(later.store.state.currentDocument.shapes)).toHaveLength(1);
        expect(messages(later)).toEqual([]);
    });

    it('saves each change, so the next start loads it', async () => {
        const indexedDB = new IDBFactory();
        const { store, effects } = await start(indexedDB);

        store.actions.addShape(rectangle);
        effects.collaboration.flush();

        const next = await start(indexedDB);

        expect(Object.keys(next.store.state.currentDocument.shapes)).toHaveLength(1);
    });

    it('merges a document’s saved updates once they add up', async () => {
        const indexedDB = new IDBFactory();
        const { store, effects } = await start(indexedDB);

        for (let index = 0; index < 100; index++) {
            store.actions.addShape(rectangle);
            effects.collaboration.flush();
        }

        expect(await (await database(indexedDB)).load('test-document')).toHaveLength(1);
        expect(
            Object.keys((await start(indexedDB)).store.state.currentDocument.shapes)
        ).toHaveLength(100);
    });

    it('keeps the document shown and each camera on the device', async () => {
        const indexedDB = new IDBFactory();
        const { store, storage } = await start(indexedDB);

        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        store.actions.addDocument({ id: 'other' });
        store.actions.openDocument('other');
        store.actions.tools.panCamera({ dx: 30, dy: 40 });
        vi.advanceTimersByTime(500);
        vi.useRealTimers();

        const next = await start(indexedDB, { seed: Object.fromEntries(storage) });

        expect(next.store.state.currentDocumentId).toBe('other');
        expect(next.store.state.documents.other.camera).toEqual(store.state.documents.other.camera);
    });

    it('loads the other documents when one cannot be loaded, and keeps it as saved', async () => {
        const indexedDB = new IDBFactory();

        await start(indexedDB);
        await (await database(indexedDB)).create('broken', new Uint8Array([9, 9, 9]));

        const next = await start(indexedDB);

        expect(Object.keys(next.store.state.documents)).toEqual(['test-document']);
        expect(messages(next)).toEqual([
            'A saved document could not be loaded. It is kept as it was saved.'
        ]);
        expect(await (await database(indexedDB)).load('broken')).toEqual([
            new Uint8Array([9, 9, 9])
        ]);
    });

    it('shares the documents a copy creates and deletes with the other open copies', async () => {
        const indexedDB = new IDBFactory();
        const hub = new Hub();
        const a = await start(indexedDB, { hub });
        const b = await start(indexedDB, { hub });

        a.store.actions.addDocument({ id: 'other', name: 'Other' });
        await Promise.resolve();
        hub.deliver();
        expect(b.store.state.documents.other.name).toBe('Other');

        b.store.actions.removeDocument('other');
        await Promise.resolve();
        hub.deliver();
        expect(a.store.state.documents.other).toBeUndefined();
        expect(await (await database(indexedDB)).documentIds()).toEqual(['test-document']);
    });

    it('picks up a document it missed while frozen once shown again', async () => {
        const indexedDB = new IDBFactory();
        const hub = new Hub();
        const document = Object.assign(new EventTarget(), { visibilityState: 'hidden' });

        vi.stubGlobal('window', Object.assign(new EventTarget(), { document }));

        const a = await start(indexedDB, { hub });
        const b = await start(indexedDB, { hub });

        hub.frozen.add(b.channel!);
        a.store.actions.addDocument({ id: 'other', name: 'Other' });
        await Promise.resolve();
        hub.deliver();
        hub.frozen.clear();
        expect(b.store.state.documents.other).toBeUndefined();

        document.visibilityState = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));

        await vi.waitFor(() => expect(b.store.state.documents.other?.name).toBe('Other'));
    });

    it('saves nothing with autosave off', async () => {
        const indexedDB = new IDBFactory();
        const { store, effects, storage } = await start(indexedDB, {
            autoSave: false,
            seed: { [PERSISTENCE_KEY]: localSave() }
        });

        store.actions.addShape(rectangle);
        effects.collaboration.flush();

        expect(Object.keys(store.state.documents)).toEqual(['saved']);
        expect(await (await database(indexedDB)).documentIds()).toEqual([]);
        expect(storage.has(`${PERSISTENCE_KEY}:backup`)).toBe(false);
    });

    it('leaves saved documents alone with autosave off, deleting included', async () => {
        const indexedDB = new IDBFactory();
        const saving = await start(indexedDB);

        saving.store.actions.addDocument({ id: 'other' });
        await Promise.resolve();

        const reading = await start(indexedDB, { autoSave: false });

        reading.store.actions.removeDocument('other');
        await Promise.resolve();

        expect(await (await database(indexedDB)).documentIds()).toEqual(['other', 'test-document']);
    });

    it('writes nothing over saved documents when they cannot be listed', async () => {
        const indexedDB = new IDBFactory();
        const first = await start(indexedDB);

        first.store.actions.addShape(rectangle);
        first.effects.collaboration.flush();
        vi.spyOn(DocumentDatabase.prototype, 'documentIds').mockRejectedValueOnce(
            new Error('Read failed')
        );

        const second = await start(indexedDB, { seed: { [PERSISTENCE_KEY]: localSave() } });

        expect(second.store.state.documents.saved).toBeUndefined();
        expect(messages(second)).toEqual([
            'Saved documents could not be read. They are kept as saved; changes made here are not kept.'
        ]);

        second.store.actions.addShape(rectangle);
        second.effects.collaboration.flush();

        const third = await start(indexedDB);

        expect(Object.keys(third.store.state.documents)).toEqual(['test-document']);
        expect(Object.keys(third.store.state.currentDocument.shapes)).toHaveLength(1);
    });

    it('keeps a document whose save failed', async () => {
        const indexedDB = new IDBFactory();
        const document = Object.assign(new EventTarget(), { visibilityState: 'hidden' });

        vi.stubGlobal('window', Object.assign(new EventTarget(), { document }));

        const { store } = await start(indexedDB);

        vi.spyOn(DocumentDatabase.prototype, 'create').mockRejectedValueOnce(
            new DOMException('Quota exceeded', 'QuotaExceededError')
        );
        store.actions.addDocument({ id: 'drawing' });
        await vi.waitFor(() => expect(messages({ store })).toHaveLength(1));

        document.visibilityState = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(store.state.documents.drawing).toBeDefined();
    });

    it('takes no other copy’s messages until its documents are loaded', async () => {
        const indexedDB = new IDBFactory();
        const hub = new Hub();
        const a = await start(indexedDB, { hub });
        const list = DocumentDatabase.prototype.documentIds;

        vi.spyOn(DocumentDatabase.prototype, 'documentIds').mockImplementationOnce(async function (
            this: DocumentDatabase
        ) {
            const documentIds = await list.call(this);

            // Another copy creates a document right after this one listed the saved ones.
            a.store.actions.addDocument({ id: 'late', name: 'Late' });
            await Promise.resolve();
            hub.deliver();

            return documentIds;
        });

        const b = await start(indexedDB, { hub });

        expect(b.store.state.documents.late.name).toBe('Late');

        b.store.actions.addDocument({ id: 'unrelated' });
        await Promise.resolve();
        hub.deliver();

        expect(a.store.state.documents.late).toBeDefined();
        expect(await (await database(indexedDB)).documentIds()).toContain('late');
    });

    it('shares a deletion made right after starting, and its replacement', async () => {
        const indexedDB = new IDBFactory();
        const hub = new Hub();
        const a = await start(indexedDB, { hub });
        const b = await start(indexedDB, { hub });

        a.store.actions.removeDocument('test-document');
        await Promise.resolve();
        hub.deliver();

        expect(Object.keys(b.store.state.documents)).toEqual(Object.keys(a.store.state.documents));
        expect(Object.keys(a.store.state.documents)).not.toContain('test-document');
    });

    it('says once when an older version saved to local storage after the move', async () => {
        const indexedDB = new IDBFactory();
        const moved = await start(indexedDB, { seed: { [PERSISTENCE_KEY]: localSave() } });
        const changed = JSON.stringify({
            ...JSON.parse(localSave()),
            currentDocumentId: 'saved',
            note: 'saved by an older version'
        });
        const seed = { ...Object.fromEntries(moved.storage), [PERSISTENCE_KEY]: changed };
        const next = await start(indexedDB, { seed });

        expect(messages(next)).toEqual([
            'An older version of the editor saved changes after your documents moved. They are not shown here; the save is kept in this browser.'
        ]);
        expect(
            messages(await start(indexedDB, { seed: Object.fromEntries(next.storage) }))
        ).toEqual([]);
    });

    it('keeps working, and says so, when documents cannot be saved', async () => {
        const unavailable = {
            open: () => {
                throw new Error('IndexedDB is unavailable');
            }
        } as unknown as IDBFactory;
        const { store } = await start(unavailable, { seed: { [PERSISTENCE_KEY]: localSave() } });

        expect(Object.keys(store.state.documents)).toEqual(['saved']);
        expect(messages({ store })).toEqual([
            'Documents cannot be saved in this browser. Changes made here are not kept.'
        ]);
    });
});
