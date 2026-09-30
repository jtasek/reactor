import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { sql } from 'kysely';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { ORIGIN, serve, type DocumentSummary } from './support';

type Served = Awaited<ReturnType<typeof serve>>;

/** How a connection to a document ended up. */
type Outcome = 'synced' | 'refused';

/**
 * Opens a document as a browser signed in with `cookie` would: over a WebSocket
 * that sends the cookie and the editor's origin.
 */
function open({ syncURL }: Served, cookie: string, documentId: string) {
    const document = new Y.Doc();
    const closed = vi.fn();
    let settle: (outcome: Outcome) => void = () => {};
    const outcome = new Promise<Outcome>((resolve) => {
        settle = resolve;
    });

    class BrowserSocket extends WebSocket {
        constructor(address: string, protocols?: string | string[]) {
            super(address, protocols, { headers: { cookie, origin: ORIGIN } });
        }
    }

    const socket = new HocuspocusProviderWebsocket({
        url: syncURL,
        WebSocketPolyfill: BrowserSocket
    });
    const provider = new HocuspocusProvider({
        websocketProvider: socket,
        name: documentId,
        document,
        onSynced: () => settle('synced'),
        onAuthenticationFailed: () => settle('refused'),
        onClose: closed
    });

    provider.attach();
    onTestFinished(() => {
        provider.destroy();
        socket.destroy();
    });

    /** Leaves the document, as closing the tab would. */
    const close = () => {
        provider.destroy();
        socket.destroy();
    };

    return { document, provider, outcome, closed, close };
}

/** The text a document's `notes` holds. */
const notes = (document: Y.Doc) => document.getText('notes').toString();

/** What the server answers a WebSocket upgrade with `headers`. */
const upgrade = ({ syncURL }: Served, headers: Record<string, string>) =>
    new Promise<number>((resolve) => {
        const socket = new WebSocket(syncURL, { headers });

        socket.on('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0));
        socket.on('open', () => {
            socket.close();
            resolve(101);
        });
    });

/** Ada with a document in her workspace, and Grace, who has no access to it yet. */
async function start(options?: Parameters<typeof serve>[0]) {
    const served = await serve(options);
    const ada = await served.user('ada@example.com');
    const grace = await served.user('grace@example.com');
    const plan = await served.json<DocumentSummary>(
        served.call('POST', `/workspaces/${ada.personal.id}/documents`, {
            cookie: ada.cookie,
            body: { name: 'Plan' }
        })
    );

    /** Makes Grace a member of Ada's workspace with `role`. */
    const joinAs = async (role: string) => {
        const { rows } = await sql<{ id: string }>`
            select id from auth.user where email = 'grace@example.com'`.execute(served.db);

        await sql`insert into workspace_members (workspace_id, user_id, role)
            values (${ada.personal.id}, ${rows[0].id}, ${role})`.execute(served.db);
    };

    return { served, ada, grace, plan, joinAs };
}

describe('document sync', () => {
    it('refuses a connection without a session, or from another site', async () => {
        const { served, ada } = await start();

        expect(await upgrade(served, { origin: ORIGIN })).toBe(401);
        expect(
            await upgrade(served, { origin: 'https://attacker.example', cookie: ada.cookie })
        ).toBe(403);
    });

    it('shares changes between copies and keeps them in the database', async () => {
        const { served, ada, plan } = await start();
        const first = open(served, ada.cookie, plan.id);
        const second = open(served, ada.cookie, plan.id);

        expect(await first.outcome).toBe('synced');
        expect(await second.outcome).toBe('synced');

        first.document.getText('notes').insert(0, 'Ship it');
        await vi.waitFor(() => expect(notes(second.document)).toBe('Ship it'));

        first.close();
        second.close();
        await vi.waitFor(async () => {
            const { rows } = await sql`
                select 1 from document_states where document_id = ${plan.id}`.execute(served.db);

            expect(rows).toHaveLength(1);
        });

        const later = open(served, ada.cookie, plan.id);

        expect(await later.outcome).toBe('synced');
        expect(notes(later.document)).toBe('Ship it');
    });

    it('refuses a document to someone who may not read it', async () => {
        const { served, grace, plan } = await start();

        expect(await open(served, grace.cookie, plan.id).outcome).toBe('refused');
    });

    it('shows a viewer the changes and drops the ones they send', async () => {
        const { served, ada, grace, plan, joinAs } = await start();

        await joinAs('viewer');

        const editor = open(served, ada.cookie, plan.id);
        const viewer = open(served, grace.cookie, plan.id);

        expect(await editor.outcome).toBe('synced');
        expect(await viewer.outcome).toBe('synced');

        editor.document.getText('notes').insert(0, 'Draft');
        await vi.waitFor(() => expect(notes(viewer.document)).toBe('Draft'));

        viewer.document.getText('notes').insert(0, 'Vandalized ');
        editor.document.getText('notes').insert(5, ' two');
        await vi.waitFor(() => expect(notes(viewer.document)).toContain(' two'));

        expect(notes(editor.document)).toBe('Draft two');
    });

    it('disconnects everyone from a document once it is deleted', async () => {
        const { served, ada, plan } = await start();
        const copy = open(served, ada.cookie, plan.id);

        expect(await copy.outcome).toBe('synced');
        expect(
            (await served.call('DELETE', `/documents/${plan.id}`, { cookie: ada.cookie })).status
        ).toBe(204);
        await vi.waitFor(() => expect(copy.closed).toHaveBeenCalled());
    });

    it('lets a user open only so many sockets, even all at once', async () => {
        const { served, ada } = await start();
        const opened = await Promise.all(
            Array.from(
                { length: 24 },
                () =>
                    new Promise<boolean>((resolve) => {
                        const socket = new WebSocket(served.syncURL, {
                            headers: { origin: ORIGIN, cookie: ada.cookie }
                        });

                        socket.on('open', () => {
                            onTestFinished(() => socket.close());
                            resolve(true);
                        });
                        socket.on('unexpected-response', () => resolve(false));
                    })
            )
        );

        expect(opened.filter(Boolean)).toHaveLength(16);
    });

    it('disconnects a socket once its session has ended', async () => {
        const { served, ada, plan } = await start({ sessionCheck: 50 });
        const copy = open(served, ada.cookie, plan.id);

        expect(await copy.outcome).toBe('synced');

        await sql`delete from auth.session`.execute(served.db);
        await vi.waitFor(() => expect(copy.closed).toHaveBeenCalled());
        expect(await upgrade(served, { origin: ORIGIN, cookie: ada.cookie })).toBe(401);
    });
});
