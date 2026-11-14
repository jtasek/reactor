import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { sql } from 'kysely';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { readPresence } from '../../server/presence';
import { ORIGIN, serve, type DocumentSummary } from './support';

type Served = Awaited<ReturnType<typeof serve>>;

/** Opens a document with awareness, as a browser signed in with `cookie` would. */
function open({ syncURL }: Served, cookie: string, documentId: string, clientId?: number) {
    class BrowserSocket extends WebSocket {
        constructor(address: string, protocols?: string | string[]) {
            super(address, protocols, { headers: { cookie, origin: ORIGIN } });
        }
    }

    const document = new Y.Doc();

    if (clientId !== undefined) {
        document.clientID = clientId;
    }

    const socket = new HocuspocusProviderWebsocket({
        url: syncURL,
        WebSocketPolyfill: BrowserSocket
    });
    let synced = () => {};
    const ready = new Promise<void>((resolve) => {
        synced = resolve;
    });
    const provider = new HocuspocusProvider({
        websocketProvider: socket,
        name: documentId,
        document,
        onSynced: () => synced()
    });

    provider.attach();

    const close = () => {
        provider.destroy();
        socket.destroy();
    };

    onTestFinished(close);

    /** The states others see, by client id, without this copy's own. */
    const others = () =>
        new Map(
            [...provider.awareness!.getStates()].filter(
                ([clientId]) => clientId !== document.clientID
            )
        );

    return { document, provider, ready, close, others };
}

const userId = async ({ db }: Served, email: string) => {
    const { rows } = await sql<{ id: string; name: string }>`
        select id, name from auth.user where email = ${email}`.execute(db);

    return rows[0];
};

/** Ada with a document Grace may edit too. */
async function start() {
    const served = await serve();
    const ada = await served.user('ada@example.com');
    const grace = await served.user('grace@example.com');
    const plan = await served.json<DocumentSummary>(
        served.call('POST', `/workspaces/${ada.personal.id}/documents`, {
            cookie: ada.cookie,
            body: { name: 'Plan' }
        })
    );
    const graceUser = await userId(served, 'grace@example.com');

    await sql`insert into workspace_members (workspace_id, user_id, role)
        values (${ada.personal.id}, ${graceUser.id}, 'viewer')`.execute(served.db);

    return { served, ada, grace, plan, adaUser: await userId(served, 'ada@example.com') };
}

describe('presence', () => {
    it('shares pointers and selections under the name the session gives', async () => {
        const { served, ada, grace, plan, adaUser } = await start();
        const first = open(served, ada.cookie, plan.id);
        const second = open(served, grace.cookie, plan.id);

        await Promise.all([first.ready, second.ready]);

        first.provider.awareness!.setLocalState({
            user: { id: 'someone-else', name: 'The admin' },
            pointer: { x: 10, y: 20 },
            selection: ['shape-1', 42, 'x'.repeat(500)],
            secret: 'kept to myself'
        });

        await vi.waitFor(() =>
            expect([...second.others().values()]).toEqual([
                {
                    user: { id: adaUser.id, name: adaUser.name },
                    pointer: { x: 10, y: 20 },
                    selection: ['shape-1']
                }
            ])
        );

        // A viewer is present too, though it cannot change the document.
        second.provider.awareness!.setLocalState({ pointer: { x: 1, y: 2 } });
        await vi.waitFor(() =>
            expect([...first.others().values()]).toEqual([
                expect.objectContaining({ pointer: { x: 1, y: 2 } })
            ])
        );

        // Once a copy leaves, the others stop showing it.
        second.close();
        await vi.waitFor(() => expect(first.others().size).toBe(0));
    });

    it("never lets a copy change another's state", async () => {
        const { served, ada, grace, plan } = await start();
        const first = open(served, ada.cookie, plan.id);
        const second = open(served, grace.cookie, plan.id);
        const watcher = open(served, ada.cookie, plan.id);

        await Promise.all([first.ready, second.ready, watcher.ready]);
        first.provider.awareness!.setLocalState({ pointer: { x: 10, y: 20 } });
        await vi.waitFor(() =>
            expect(watcher.others().get(first.document.clientID)).toMatchObject({
                pointer: { x: 10, y: 20 }
            })
        );

        // Another copy of Grace's claims Ada's copy's client id, with a newer clock.
        const forger = open(served, grace.cookie, plan.id, first.document.clientID);

        await forger.ready;
        for (let round = 0; round < 5; round++) {
            forger.provider.awareness!.setLocalState({ pointer: { x: 999, y: 999 }, round });
        }

        // Grace's own pointer still arrives, so the forged message was read and dropped.
        second.provider.awareness!.setLocalState({ pointer: { x: 3, y: 4 } });
        await vi.waitFor(() =>
            expect(watcher.others().get(second.document.clientID)).toMatchObject({
                pointer: { x: 3, y: 4 }
            })
        );
        expect(watcher.others().get(first.document.clientID)).toMatchObject({
            pointer: { x: 10, y: 20 }
        });
    });

    it('keeps only a pointer of numbers and a list of shape ids', () => {
        const user = { userId: 'ada', name: 'Ada' };

        expect(readPresence(null, user)).toEqual({ user: { id: 'ada', name: 'Ada' } });
        expect(readPresence({ pointer: { x: 'a', y: 1 }, selection: 'shape' }, user)).toEqual({
            user: { id: 'ada', name: 'Ada' }
        });
        expect(
            readPresence({ selection: Array.from({ length: 600 }, (_, i) => `${i}`) }, user)
                .selection
        ).toHaveLength(500);
    });
});
