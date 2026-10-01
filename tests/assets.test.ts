import { IDBFactory } from 'fake-indexeddb';
import { MAX_IMAGE_BYTES, createAssets, readImage } from 'src/app/services/assets';
import { DocumentDatabase } from 'src/app/services/documentDatabase';
import { registerTool } from 'src/app/actions/startup';
import { ImageTool, SelectTool } from 'src/tools';
import { createTestStore } from './support/store';

// Tools are registered by application startup, which the test store skips.
registerTool(ImageTool);
registerTool(SelectTool);

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0));

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3);
const GIF = bytes(...ascii('GIF89a'), 1, 2, 3);
const WEBP = bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), 1, 2, 3);
const SVG = bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));

/** The SHA-256 of the PNG above, in hex. */
const pngHash = async () =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', PNG))]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

describe('reading an image file', () => {
    it.each([
        ['PNG', PNG, 'image/png'],
        ['JPEG', JPEG, 'image/jpeg'],
        ['GIF', GIF, 'image/gif'],
        ['WebP', WEBP, 'image/webp']
    ])('takes a %s by its content, whatever type the file claims', async (_, content, type) => {
        const image = await readImage(new Blob([content], { type: 'text/plain' }));

        expect(image).toMatchObject({ type, bytes: content });
    });

    it('names the image by the SHA-256 of its bytes', async () => {
        expect((await readImage(new Blob([PNG])))?.hash).toBe(await pngHash());
    });

    it('refuses SVG and anything else that is not an image it takes', async () => {
        expect(await readImage(new Blob([SVG], { type: 'image/svg+xml' }))).toBeNull();
        expect(await readImage(new Blob([bytes(1, 2, 3)], { type: 'image/png' }))).toBeNull();
    });

    it('refuses an image over the size limit', async () => {
        const large = new Uint8Array(MAX_IMAGE_BYTES + 1);

        large.set(PNG);

        expect(await readImage(new Blob([large]))).toBeNull();
    });
});

describe('keeping images', () => {
    it('stores an image once in the database and gives it back', async () => {
        const database = await DocumentDatabase.open(new IDBFactory());

        await database.putAsset({ hash: 'a', type: 'image/png', bytes: PNG });
        await database.putAsset({ hash: 'a', type: 'image/png', bytes: PNG });

        expect(await database.asset('a')).toEqual({ hash: 'a', type: 'image/png', bytes: PNG });
        expect(await database.asset('b')).toBeUndefined();
    });

    it('upgrades a database saved before images, keeping its documents', async () => {
        const factory = new IDBFactory();

        await new Promise<void>((resolve, reject) => {
            const opening = factory.open('reactor', 1);

            opening.onupgradeneeded = () => {
                opening.result
                    .createObjectStore('documents', { keyPath: 'id' })
                    .put({ id: 'kept' });
                opening.result
                    .createObjectStore('updates', { autoIncrement: true })
                    .createIndex('documentId', 'documentId');
            };
            opening.onsuccess = () => {
                opening.result.close();
                resolve();
            };
            opening.onerror = () => reject(opening.error);
        });

        const database = await DocumentDatabase.open(factory);

        await database.putAsset({ hash: 'a', type: 'image/png', bytes: PNG });

        expect(await database.documentIds()).toEqual(['kept']);
        expect((await database.asset('a'))?.type).toBe('image/png');
    });

    it('adds an image as an asset named by its hash, and shows it through one address', async () => {
        const assets = createAssets({ measure: async () => ({ width: 200, height: 100 }) });

        assets.use(DocumentDatabase.open(new IDBFactory()));

        const added = await assets.add(new Blob([PNG]));

        expect(added).toEqual({ source: `asset:${await pngHash()}`, ratio: 2 });
        expect(await assets.url(added.source)).toMatch(/^blob:/);
        expect(await assets.url(added.source)).toBe(await assets.url(added.source));
        expect(await assets.url('/images/avatar.jpg')).toBe('/images/avatar.jpg');
        expect(await assets.url('asset:missing')).toBeUndefined();
    });
});

describe('the image tool', () => {
    /** Lets the file be read, kept and applied, which takes several tasks. */
    const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

    it('asks for an image when chosen, then draws it at its proportions', async () => {
        const { store } = createTestStore({}, { pickImage: async () => new Blob([PNG]) });
        const { events } = store.actions;

        store.actions.tools.activateTool('image');
        await settle();

        expect(store.state.tools.imageToPlace).toEqual({
            source: `asset:${await pngHash()}`,
            ratio: 2
        });

        events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });
        events.endGesture({ pointerId: 1, position: { x: 110, y: 20 } });

        const [shape] = Object.values(store.state.currentDocument.shapes);

        expect(shape).toMatchObject({
            type: 'image',
            source: `asset:${await pngHash()}`,
            position: { x: 10, y: 10 },
            size: { width: 100, height: 50 }
        });
    });

    it('goes back to selecting when no image is chosen', async () => {
        const { store } = createTestStore({}, { pickImage: async () => null });

        store.actions.tools.activateTool('image');
        await settle();

        expect(store.state.tools.activeToolsIds).toEqual(['select']);
        expect(store.state.notifications).toEqual([]);
    });

    it('says images cannot be kept, not that the file is wrong, without a database', async () => {
        const { store, effects } = createTestStore({}, { pickImage: async () => new Blob([PNG]) });

        effects.assets.use(undefined);
        store.actions.tools.activateTool('image');
        await settle();

        expect(store.state.notifications.map(({ message }) => message)).toEqual([
            'Images cannot be kept in this browser, so none can be added.'
        ]);
    });

    it('draws nothing while a newly chosen image is being read', async () => {
        let choose: (file: Blob) => void = () => {};
        const { store } = createTestStore(
            {},
            { pickImage: () => new Promise<Blob>((resolve) => (choose = resolve)) }
        );
        const { events } = store.actions;

        store.actions.tools.setImageToPlace({ source: 'asset:earlier', ratio: 1 });
        store.actions.tools.activateTool('image');
        events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });
        events.endGesture({ pointerId: 1, position: { x: 110, y: 20 } });
        choose(new Blob([PNG]));
        await settle();

        expect(store.state.currentDocument.shapesIds).toEqual([]);
    });

    it('says why a file is not taken, and draws nothing without an image', async () => {
        const { store } = createTestStore({}, { pickImage: async () => new Blob([SVG]) });
        const { events } = store.actions;

        store.actions.tools.activateTool('image');
        events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });
        events.endGesture({ pointerId: 1, position: { x: 110, y: 20 } });
        await settle();

        expect(store.state.currentDocument.shapesIds).toEqual([]);
        expect(store.state.notifications.map(({ message }) => message)).toEqual([
            'That file is not a PNG, JPEG, GIF or WebP image of 5 MB or less.'
        ]);
        expect(store.state.tools.activeToolsIds).toEqual(['select']);
    });
});
