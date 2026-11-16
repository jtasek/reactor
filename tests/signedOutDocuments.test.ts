import { IDBFactory } from 'fake-indexeddb';
import { createDocument, createShape } from 'src/app/factories';
import type { Document } from 'src/app/types';
import type { AccountUser, Accounts } from 'src/app/services/accounts';
import type { Api } from 'src/app/services/api';
import { Collaboration } from 'src/app/services/collaboration';
import { DocumentDatabase } from 'src/app/services/documentDatabase';
import { accountCopy } from 'src/app/services/documentSync';
import {
    keepSignedOutDocuments,
    listSignedOutDocuments,
    moveSignedOutDocuments
} from 'src/app/services/signedOutDocuments';
import { DEFAULT_DOCUMENT_SIZE } from 'src/app/services/documentSize';
import { createTestStore } from './support/store';

const ada: AccountUser = { id: 'user-ada', name: 'Ada', email: 'ada@example.com' };

const accounts: Accounts = {
    session: async () => ada,
    signIn: async () => ({ ok: true }),
    signUp: async () => ({ ok: true }),
    sendSignInLink: async () => ({ ok: true }),
    signOut: async () => ({ ok: true })
};

const image = { hash: 'cafe', type: 'image/png', bytes: new Uint8Array([1, 2, 3]) };

/** A document holding one shape: an image of `image` when `withImage`, else a rectangle. */
function drawing(id: string, name: string, withImage = false, text = '') {
    const document = createDocument({ id, name });
    const shape = createShape({
        ...(withImage
            ? { type: 'image' as const, source: `asset:${image.hash}` }
            : { type: 'rectangle' as const }),
        position: { x: 0, y: 0 },
        size: { width: 20, height: 10 },
        order: 'a0',
        name: text || 'shape'
    });

    document.shapes[shape.id] = shape;

    return document;
}

async function stateOf(document: Document) {
    const collaboration = new Collaboration();

    await collaboration.initialize({
        getDocument: () => document,
        applyRemoteChanges: () => {},
        addMutationListener: () => () => {}
    });
    collaboration.open(document.id);
    const state = collaboration.state(document.id);
    collaboration.dispose();

    return state;
}

/** A browser that keeps `documents` signed out, with `image`. */
async function browserWith(documents: Document[]) {
    const indexedDB = new IDBFactory();
    const database = await DocumentDatabase.open(indexedDB);

    for (const document of documents) {
        await database.create(document.id, await stateOf(document));
    }
    await database.putAsset(image);
    database.close();

    return indexedDB;
}

/** Ada signed in on `indexedDB`'s browser, with a server that records the documents created. */
async function signIn(indexedDB: IDBFactory, storage = new Map<string, string>()) {
    const created: string[] = [];
    const api: Api = {
        workspaces: async () => [
            { id: 'personal', kind: 'personal', name: 'Ada', role: 'admin', ai: true }
        ],
        documents: async () => [],
        createDocument: async (_workspace, { id }) => {
            created.push(id);

            return true;
        },
        deleteDocument: async () => {},
        aiAvailable: async () => false
    };
    const test = createTestStore({}, { autoSave: true, indexedDB, accounts, api, storage });

    await test.store.onInitialize();

    const held = (id: string) => Object.hasOwn(test.store.state.documents, id);

    return { ...test, created, held };
}

const signedOutIds = async (indexedDB: IDBFactory) => {
    const database = await DocumentDatabase.open(indexedDB);
    const ids = await database.documentIds();

    database.close();

    return ids;
};

describe('signed-out documents', () => {
    it('offers documents with content, not blank or deleted ones', async () => {
        const blank = createDocument({ id: 'blank' });
        const deleted = drawing('deleted', 'Old');
        deleted.deleted = new Date();
        const indexedDB = await browserWith([drawing('plan', 'Plan', true), blank, deleted]);
        const { effects, held } = await signIn(indexedDB);

        const offered = await listSignedOutDocuments(effects, ada.id, held);

        expect(offered.map(({ id, name, images }) => ({ id, name, images }))).toEqual([
            { id: 'plan', name: 'Plan', images: [image.hash] }
        ]);
    });

    it('offers the readable documents when one cannot be read', async () => {
        const indexedDB = await browserWith([drawing('plan', 'Plan')]);
        const database = await DocumentDatabase.open(indexedDB);

        // Not an update at all, as a damaged record reads.
        await database.create('broken', 'damaged' as unknown as Uint8Array);
        await database.append('broken', 'records' as unknown as Uint8Array);
        database.close();

        const { effects, held } = await signIn(indexedDB);

        expect((await listSignedOutDocuments(effects, ada.id, held)).map(({ id }) => id)).toEqual([
            'plan'
        ]);
        expect(await signedOutIds(indexedDB)).toEqual(['broken', 'plan']);
    });

    it('moves documents into the account with their images, and offers them no more', async () => {
        const indexedDB = await browserWith([drawing('plan', 'Plan', true), drawing('map', 'Map')]);
        const storage = new Map<string, string>();
        const { effects, held } = await signIn(indexedDB, storage);
        const offered = await listSignedOutDocuments(effects, ada.id, held);

        const result = await moveSignedOutDocuments(
            effects,
            ada.id,
            offered,
            DEFAULT_DOCUMENT_SIZE.uploadBytes
        );

        expect(result.moved.map(({ id }) => id).sort()).toEqual(['map', 'plan']);
        expect(await signedOutIds(indexedDB)).toEqual([]);

        const account = await DocumentDatabase.open(indexedDB, accountCopy(ada.id).database);

        expect(await account.documentIds()).toEqual(expect.arrayContaining(['plan', 'map']));
        expect(await account.asset(image.hash)).toEqual(image);
        account.close();

        // The account's editor opens them as its own, and creates them on the server.
        const later = await signIn(indexedDB, storage);

        expect(later.store.state.documents.plan.name).toBe('Plan');
        expect(Object.keys(later.store.state.documents.plan.shapes)).toHaveLength(1);
        expect(later.store.state.documents.map.name).toBe('Map');
        expect(later.store.state.documentAccess.plan.role).toBe('admin');
        await vi.waitFor(() =>
            expect(later.created).toEqual(expect.arrayContaining(['plan', 'map']))
        );
        expect(await listSignedOutDocuments(later.effects, ada.id, later.held)).toEqual([]);
    });

    it('keeps documents in the browser when skipped, and does not offer them again', async () => {
        const indexedDB = await browserWith([drawing('plan', 'Plan')]);
        const { store, effects, held } = await signIn(indexedDB);
        const offered = await listSignedOutDocuments(effects, ada.id, held);

        keepSignedOutDocuments(effects, ada.id, offered);

        expect(store.state.documents.plan).toBeUndefined();
        expect(await signedOutIds(indexedDB)).toEqual(['plan']);
        expect(await listSignedOutDocuments(effects, ada.id, held)).toEqual([]);
    });

    it('keeps a document too large for the server in the browser', async () => {
        const large = drawing(
            'large',
            'Large',
            false,
            'x'.repeat(DEFAULT_DOCUMENT_SIZE.uploadBytes)
        );
        const indexedDB = await browserWith([large, drawing('plan', 'Plan')]);
        const { effects, held } = await signIn(indexedDB);
        const offered = await listSignedOutDocuments(effects, ada.id, held);

        const result = await moveSignedOutDocuments(
            effects,
            ada.id,
            offered,
            DEFAULT_DOCUMENT_SIZE.uploadBytes
        );

        expect(result.tooLarge.map(({ id }) => id)).toEqual(['large']);
        expect(result.moved.map(({ id }) => id)).toEqual(['plan']);
        expect(await signedOutIds(indexedDB)).toEqual(['large']);
        expect(await listSignedOutDocuments(effects, ada.id, held)).toEqual([]);
    });
});
