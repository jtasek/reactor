import { IDBFactory } from 'fake-indexeddb';
import WebSocket from 'ws';
import type { AccountUser, Accounts } from 'src/app/services/accounts';
import type { Api } from 'src/app/services/api';
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
