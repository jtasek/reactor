import { IDBFactory } from 'fake-indexeddb';
import WebSocket from 'ws';
import type { AccountUser, Accounts } from 'src/app/services/accounts';
import type { Api } from 'src/app/services/api';
import type { AssetServer } from 'src/app/services/assetSync';
import { DocumentDatabase } from 'src/app/services/documentDatabase';
import { createTestStore } from '../support/store';
import { ORIGIN, serve, type DocumentSummary } from './support';

type Served = Awaited<ReturnType<typeof serve>>;

const rectangle = {
    type: 'rectangle' as const,
    position: { x: 10, y: 20 },
    size: { width: 30, height: 40 }
};

const ada = { id: 'user-ada', name: 'Ada', email: 'ada@example.com' };

/** Accounts on a server where `user` is signed in. */
const signedInAs = (user: AccountUser): Accounts => ({
    session: async () => user,
    signIn: async () => ({ ok: true }),
    signUp: async () => ({ ok: true }),
    sendSignInLink: async () => ({ ok: true }),
    signOut: async () => ({ ok: true })
});

/**
 * The API as a browser holding `cookie` calls it; `online` says whether the server
 * can be reached, and document lists wait for `listing`.
 */
function apiFor(
    { call }: Served,
    cookie: string,
    online = () => true,
    listing = () => Promise.resolve()
): Api {
    const send = async (method: string, path: string, body?: object) => {
        if (!online()) {
            throw new Error('The server cannot be reached');
        }

        return call(method, path, { cookie, body });
    };
    const read = async <T>(path: string) => {
        const response = await send('GET', path);

        if (!response.ok) {
            throw new Error(`GET ${path} failed: ${response.status}`);
        }

        return (await response.json()) as T;
    };

    return {
        workspaces: () => read('/workspaces'),
        documents: async (workspaceId) => {
            await listing();

            return read(`/workspaces/${workspaceId}/documents`);
        },
        createDocument: async (workspaceId, document) =>
            (await send('POST', `/workspaces/${workspaceId}/documents`, document)).ok,
        deleteDocument: async (documentId) => {
            await send('DELETE', `/documents/${documentId}`);
        }
    };
}

/** The images of documents as a browser holding `cookie` uploads and reads them. */
function assetServerFor({ call }: Served, cookie: string, online = () => true): AssetServer {
    const send = async (method: string, path: string, body?: Uint8Array) => {
        if (!online()) {
            throw new Error('The server cannot be reached');
        }

        return call(method, path, { cookie, body });
    };

    return {
        assetHashes: async (documentId) => {
            const response = await send('GET', `/documents/${documentId}/assets`);

            if (!response.ok) {
                throw new Error(`The images could not be listed: ${response.status}`);
            }

            return (await response.json()) as string[];
        },
        uploadAsset: async (documentId, hash, { bytes }) => {
            const response = await send('PUT', `/documents/${documentId}/assets/${hash}`, bytes);

            if (response.status === 404) {
                throw new Error('No such document yet');
            }

            return response.ok ? 'kept' : response.status === 413 ? 'noRoom' : 'refused';
        },
        asset: async (documentId, hash) => {
            const response = await send('GET', `/documents/${documentId}/assets/${hash}`);

            return response.ok
                ? {
                      type: response.headers.get('content-type') ?? '',
                      bytes: new Uint8Array(await response.arrayBuffer())
                  }
                : undefined;
        }
    };
}

/**
 * A copy of the editor holding `cookie`, which last showed Ada's documents, on a
 * browser whose database is `indexedDB` and local storage `storage`.
 */
async function device(
    served: Served,
    cookie: string,
    {
        indexedDB = new IDBFactory(),
        online = () => true,
        storage = new Map<string, string>(),
        user = ada,
        listing
    }: {
        indexedDB?: IDBFactory;
        online?: () => boolean;
        storage?: Map<string, string>;
        user?: AccountUser;
        listing?: () => Promise<void>;
    } = {}
) {
    class BrowserSocket extends WebSocket {
        constructor(address: string, protocols?: string | string[]) {
            super(address, protocols, { headers: { cookie, origin: ORIGIN } });
        }
    }

    const test = createTestStore(
        {},
        {
            autoSave: true,
            indexedDB,
            storage,
            accounts: signedInAs(user),
            lastOwner: ada.id,
            api: apiFor(served, cookie, online, listing),
            assetServer: assetServerFor(served, cookie, online),
            serverTransport: { url: served.syncURL, WebSocketPolyfill: BrowserSocket }
        }
    );

    await test.store.onInitialize();
    onTestFinished(() => test.effects.collaboration.dispose());

    return { ...test, indexedDB };
}

/** The same browser started again, with what it saved. */
function restart(
    served: Served,
    cookie: string,
    { indexedDB, storage }: Device,
    online = () => true,
    user = ada,
    listing?: () => Promise<void>
) {
    return device(served, cookie, { indexedDB, storage, online, user, listing });
}

type Device = Awaited<ReturnType<typeof device>>;

const documentIds = ({ store }: Device) => Object.keys(store.state.documents);

const shapeCount = ({ store }: Device, documentId: string) =>
    Object.keys(store.state.documents[documentId]?.shapes ?? {}).length;

const serverDocuments = ({ call }: Served, cookie: string, workspaceId: string) =>
    call('GET', `/workspaces/${workspaceId}/documents`, { cookie }).then(
        (response) => response.json() as Promise<DocumentSummary[]>
    );

describe('editor sync', () => {
    it('shows an account’s documents on each device and syncs changes both ways', async () => {
        const served = await serve();
        const { cookie, personal } = await served.user('ada@example.com');
        const first = await device(served, cookie);
        const [documentId] = documentIds(first);

        await vi.waitFor(async () =>
            expect(await serverDocuments(served, cookie, personal.id)).toEqual([
                expect.objectContaining({ id: documentId })
            ])
        );
        first.store.actions.addShape(rectangle);

        const second = await device(served, cookie);

        // Rather than a new document of its own.
        expect(documentIds(second)).toEqual([documentId]);
        await vi.waitFor(() => expect(shapeCount(second, documentId)).toBe(1));

        second.store.actions.addShape({ ...rectangle, position: { x: 50, y: 60 } });
        await vi.waitFor(() => expect(shapeCount(first, documentId)).toBe(2));
        await vi.waitFor(() => expect(first.store.state.saveStatus).toEqual({ kind: 'saved' }));
    });

    it('sends a document made while the server could not be reached once it can', async () => {
        const served = await serve();
        const { cookie, personal } = await served.user('ada@example.com');
        const offline = await device(served, cookie, { online: () => false });
        const [documentId] = documentIds(offline);

        offline.store.actions.addShape(rectangle);

        await vi.waitFor(() => expect(offline.store.state.saveStatus).toEqual({ kind: 'offline' }));
        expect(await serverDocuments(served, cookie, personal.id)).toEqual([]);

        await restart(served, cookie, offline);
        await vi.waitFor(async () =>
            expect(await serverDocuments(served, cookie, personal.id)).toEqual([
                expect.objectContaining({ id: documentId })
            ])
        );

        const other = await device(served, cookie);

        await vi.waitFor(() => expect(shapeCount(other, documentId)).toBe(1));
    });

    it('removes a document deleted on another device, here and from the browser database', async () => {
        const served = await serve();
        const { cookie, personal } = await served.user('ada@example.com');
        const first = await device(served, cookie);
        const [documentId] = documentIds(first);

        await vi.waitFor(async () =>
            expect(await serverDocuments(served, cookie, personal.id)).toHaveLength(1)
        );

        const second = await device(served, cookie);

        second.store.actions.newDocument();
        second.store.actions.removeDocument(documentId);
        await vi.waitFor(async () =>
            expect(
                (await serverDocuments(served, cookie, personal.id)).map(({ id }) => id)
            ).not.toContain(documentId)
        );

        await vi.waitFor(() => expect(documentIds(first)).not.toContain(documentId));
        await vi.waitFor(async () =>
            expect(
                await (
                    await DocumentDatabase.open(first.indexedDB, 'reactor-user-ada')
                ).documentIds()
            ).not.toContain(documentId)
        );
    });

    it('deletes a document deleted while the server could not be reached once it can', async () => {
        const served = await serve();
        const { cookie, personal } = await served.user('ada@example.com');
        let online = true;
        const first = await device(served, cookie, { online: () => online });
        const [documentId] = documentIds(first);

        await vi.waitFor(async () =>
            expect(await serverDocuments(served, cookie, personal.id)).toHaveLength(1)
        );

        online = false;
        first.store.actions.newDocument();
        first.store.actions.removeDocument(documentId);
        await vi.waitFor(() => expect(first.store.state.saveStatus).toEqual({ kind: 'offline' }));

        online = true;
        await restart(served, cookie, first);
        await vi.waitFor(async () =>
            expect(
                (await serverDocuments(served, cookie, personal.id)).map(({ id }) => id)
            ).not.toContain(documentId)
        );
    });

    it('connects a document again after the server closes it, as when it restarts', async () => {
        const served = await serve();
        const { cookie, personal } = await served.user('ada@example.com');
        const first = await device(served, cookie);
        const [documentId] = documentIds(first);

        await vi.waitFor(async () =>
            expect(await serverDocuments(served, cookie, personal.id)).toHaveLength(1)
        );

        const second = await device(served, cookie);

        served.sync.closeDocument(documentId);
        second.store.actions.addShape(rectangle);

        await vi.waitFor(() => expect(shapeCount(first, documentId)).toBe(1), { timeout: 10_000 });
        expect(documentIds(first)).toEqual([documentId]);
    });

    it('leaves one account’s documents alone once another is signed in', async () => {
        const served = await serve();
        const adaCookie = (await served.user('ada@example.com')).cookie;
        const grace = await served.user('grace@example.com');
        const offline = await device(served, adaCookie, { online: () => false });
        const [documentId] = documentIds(offline);

        // Grace signs in with an emailed link, where Ada's documents were shown last.
        const later = await restart(served, grace.cookie, offline, () => true, {
            id: 'user-grace',
            name: 'Grace',
            email: 'grace@example.com'
        });

        await vi.waitFor(() => expect(later.store.state.saveStatus).toEqual({ kind: 'offline' }));
        expect(await serverDocuments(served, grace.cookie, grace.personal.id)).toEqual([]);
        expect(documentIds(later)).toEqual([documentId]);
    });

    it('keeps a document made while the server’s list was on its way', async () => {
        const served = await serve();
        const { cookie, personal } = await served.user('ada@example.com');
        const first = await device(served, cookie);

        await vi.waitFor(async () =>
            expect(await serverDocuments(served, cookie, personal.id)).toHaveLength(1)
        );

        let holding = false;
        let list: () => void = () => {};
        const listed = new Promise<void>((resolve) => (list = resolve));
        const later = await restart(
            served,
            cookie,
            first,
            () => true,
            ada,
            () => (holding ? listed : Promise.resolve())
        );
        const [documentId] = documentIds(later);

        await vi.waitFor(() => expect(later.store.state.saveStatus).toEqual({ kind: 'saved' }));

        // The server closing the document makes the copy ask for the list again.
        holding = true;
        served.sync.closeDocument(documentId);
        await vi.waitFor(() => expect(later.store.state.saveStatus).toEqual({ kind: 'syncing' }));
        later.store.actions.newDocument();

        const made = later.store.state.currentDocumentId;

        await vi.waitFor(async () =>
            expect(
                (await serverDocuments(served, cookie, personal.id)).map(({ id }) => id)
            ).toContain(made)
        );
        list();
        await vi.waitFor(() => expect(later.store.state.saveStatus).toEqual({ kind: 'saved' }));

        expect(documentIds(later)).toContain(made);
    });

    it('never brings back a document deleted elsewhere that two tabs hold', async () => {
        const served = await serve();
        const { cookie, personal } = await served.user('ada@example.com');
        const first = await device(served, cookie);
        const [documentId] = documentIds(first);

        await vi.waitFor(async () =>
            expect(await serverDocuments(served, cookie, personal.id)).toHaveLength(1)
        );

        const second = await restart(served, cookie, first);

        first.store.actions.newDocument();
        await vi.waitFor(async () =>
            expect(await serverDocuments(served, cookie, personal.id)).toHaveLength(2)
        );
        await served.call('DELETE', `/documents/${documentId}`, { cookie });

        await vi.waitFor(() => expect(documentIds(first)).not.toContain(documentId));
        await vi.waitFor(() => expect(documentIds(second)).not.toContain(documentId));
        await vi.waitFor(() => expect(second.store.state.saveStatus).toEqual({ kind: 'saved' }));
        expect(
            (await serverDocuments(served, cookie, personal.id)).map(({ id }) => id)
        ).not.toContain(documentId);
    });
});

/**
 * How long a test waits for images to be shared. A change's images wait a second before
 * they are looked over, which a busy machine stretches.
 */
const SHARING_MS = 10_000;

/** Above the default, as an image another device has not uploaded yet is asked for again after seconds. */
const IMAGE_TEST_MS = 30_000;

describe('images when signed in', { timeout: IMAGE_TEST_MS }, () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const assetPath = (documentId: string, source: string) =>
        `/documents/${documentId}/assets/${source.slice('asset:'.length)}`;
    /** Waits for the server to keep `source` for a document. */
    const uploaded = (served: Served, cookie: string, documentId: string, source: string) =>
        vi.waitFor(
            async () =>
                expect(
                    (await served.call('HEAD', assetPath(documentId, source), { cookie })).status
                ).toBe(200),
            { timeout: SHARING_MS }
        );

    /** Adds an image shape showing `png` to the device's document. */
    async function addImage({ store, effects }: Device) {
        const { source } = await effects.assets.add(new Blob([png]));

        store.actions.addShape({
            type: 'image',
            position: { x: 0, y: 0 },
            size: { width: 20, height: 10 },
            source
        });

        return source;
    }

    it('uploads an image for its document and shows it on another device', async () => {
        const served = await serve();
        const { cookie } = await served.user('ada@example.com');
        const first = await device(served, cookie);
        const [documentId] = documentIds(first);
        const source = await addImage(first);

        await uploaded(served, cookie, documentId, source);

        const second = await device(served, cookie);

        expect(await second.effects.assets.url(source)).toBeUndefined();
        expect(await second.effects.assets.url(source, documentId)).toMatch(/^blob:/);

        // Kept on the second device, it shows without the server.
        const offline = await restart(served, cookie, second, () => false);

        expect(await offline.effects.assets.url(source)).toMatch(/^blob:/);
    });

    it('waits for an image another device has not uploaded yet', async () => {
        const served = await serve();
        const { cookie } = await served.user('ada@example.com');
        const first = await device(served, cookie);
        const second = await device(served, cookie);
        const [documentId] = documentIds(first);
        const { source } = await first.effects.assets.add(new Blob([png]));
        const shown = second.effects.assets.url(source, documentId);

        first.store.actions.addShape({
            type: 'image',
            position: { x: 0, y: 0 },
            size: { width: 20, height: 10 },
            source
        });

        expect(await shown).toMatch(/^blob:/);
    });

    it('uploads an image again for a document it is cloned into', async () => {
        const served = await serve();
        const { cookie } = await served.user('ada@example.com');
        const first = await device(served, cookie);
        const [documentId] = documentIds(first);
        const source = await addImage(first);

        // The server takes only UUIDs as document ids.
        first.effects.newId.mockImplementation(() => crypto.randomUUID());
        first.store.actions.cloneDocument(documentId);
        const cloneId = documentIds(first).find((id) => id !== documentId)!;

        await uploaded(served, cookie, cloneId, source);
    });

    it('uploads an image added to another document for that document too', async () => {
        const served = await serve();
        const { cookie } = await served.user('ada@example.com');
        const first = await device(served, cookie);
        const source = await addImage(first);

        // The server takes only UUIDs as document ids.
        first.effects.newId.mockImplementation(() => crypto.randomUUID());
        first.store.actions.newDocument();
        const otherId = first.store.state.currentDocumentId;

        first.store.actions.addShape({
            type: 'image',
            position: { x: 0, y: 0 },
            size: { width: 20, height: 10 },
            source
        });

        await uploaded(served, cookie, otherId, source);
    });

    it('says once that the workspace has no room for more images', async () => {
        const served = await serve({ assetQuota: 4 });
        const { cookie } = await served.user('ada@example.com');
        const first = await device(served, cookie);
        const notices = () =>
            first.store.state.notifications.filter(({ type }) => type === 'error').length;

        await addImage(first);
        await vi.waitFor(() => expect(notices()).toBe(1), { timeout: SHARING_MS });

        const { source } = await first.effects.assets.add(new Blob([new Uint8Array([...png, 4])]));

        first.store.actions.addShape({
            type: 'image',
            position: { x: 40, y: 0 },
            size: { width: 20, height: 10 },
            source
        });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        expect(notices()).toBe(1);
    });

    it('uploads an image again with the next change once the server can be reached', async () => {
        const served = await serve();
        const { cookie } = await served.user('ada@example.com');
        let online = true;
        const first = await device(served, cookie, { online: () => online });
        const [documentId] = documentIds(first);
        const server = first.effects.assetServer()!;

        online = false;
        const source = await addImage(first);
        const tries = [vi.spyOn(server, 'assetHashes'), vi.spyOn(server, 'uploadAsset')];

        // The image's first try fails while the server cannot be reached.
        await vi.waitFor(() => expect(tries.some(({ mock }) => mock.calls.length)).toBe(true), {
            timeout: SHARING_MS
        });
        online = true;
        first.store.actions.addShape(rectangle);

        await uploaded(served, cookie, documentId, source);
    });
});
