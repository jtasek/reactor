import { createHash } from 'node:crypto';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { sql } from 'kysely';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { deleteUnusedAssets, postgresBlobs } from '../../server/assets';
import { insertSnapshot, pruneSnapshots } from '../../server/history';
import { ORIGIN, serve, type DocumentSummary } from './support';

type Served = Awaited<ReturnType<typeof serve>>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface Snapshot {
    id: string;
    reason: string;
    version: number;
    restorable: boolean;
    createdAt: string;
}

/** Opens a document as a signed-in browser would, until the test ends. */
async function open({ syncURL }: Served, cookie: string, documentId: string) {
    const document = new Y.Doc();

    class BrowserSocket extends WebSocket {
        constructor(address: string, protocols?: string | string[]) {
            super(address, protocols, { headers: { cookie, origin: ORIGIN } });
        }
    }

    const socket = new HocuspocusProviderWebsocket({
        url: syncURL,
        WebSocketPolyfill: BrowserSocket
    });
    const synced = new Promise<void>((resolve) => {
        const provider = new HocuspocusProvider({
            websocketProvider: socket,
            name: documentId,
            document,
            onSynced: () => resolve()
        });

        provider.attach();
        onTestFinished(() => {
            provider.destroy();
            socket.destroy();
        });
    });

    await synced;

    return document;
}

const notes = (document: Y.Doc) => document.getText('notes').toString();

const fromState = (state: Uint8Array) => {
    const document = new Y.Doc();
    Y.applyUpdate(document, state);
    return document;
};

/** Ada with a document, a clock the test moves on, and the calls the history makes. */
async function start({ editorVersion }: { editorVersion?: number } = {}) {
    let time = new Date('2026-11-14T09:00:00Z').getTime();
    const served = await serve({ now: () => new Date(time), editorVersion });
    const ada = await served.user('ada@example.com');
    const grace = await served.user('grace@example.com');
    const createIn = (workspaceId: string, cookie: string, name: string, id?: string) =>
        served.json<DocumentSummary>(
            served.call('POST', `/workspaces/${workspaceId}/documents`, {
                cookie,
                body: { name, id }
            })
        );
    const plan = await createIn(ada.personal.id, ada.cookie, 'Plan');

    /** Makes Grace a member of Ada's workspace with `role`. */
    const joinAs = async (role: string) => {
        const { rows } = await sql<{ id: string }>`
            select id from auth.user where email = 'grace@example.com'`.execute(served.db);

        await sql`insert into workspace_members (workspace_id, user_id, role)
            values (${ada.personal.id}, ${rows[0].id}, ${role})`.execute(served.db);
    };

    /** The document's content as the database holds it. */
    const saved = async (documentId = plan.id) => {
        const row = await served.db
            .selectFrom('document_states')
            .select('state')
            .where('document_id', '=', documentId)
            .executeTakeFirst();

        return row && fromState(new Uint8Array(row.state));
    };

    /** Waits until the server has saved `text` as the document's notes. */
    const savedNotes = (text: string) =>
        vi.waitFor(
            async () => {
                const document = await saved();
                expect(document && notes(document)).toBe(text);
            },
            { timeout: 15_000 }
        );

    const history = (cookie = ada.cookie, documentId = plan.id) =>
        served.call('GET', `/documents/${documentId}/history`, { cookie });
    const snapshots = async (cookie = ada.cookie) => served.json<Snapshot[]>(history(cookie));
    const content = async (id: string, cookie = ada.cookie) => {
        const response = await served.call('GET', `/documents/${plan.id}/history/${id}`, {
            cookie
        });

        return response.ok ? fromState(new Uint8Array(await response.arrayBuffer())) : response;
    };
    const restore = (id: string, cookie = ada.cookie, documentId = plan.id) =>
        served.call('POST', `/documents/${documentId}/history/${id}/restore`, { cookie });

    return {
        served,
        ada,
        grace,
        plan,
        joinAs,
        createIn,
        saved,
        savedNotes,
        history,
        snapshots,
        content,
        restore,
        later: (ms: number) => {
            time += ms;
        },
        now: () => new Date(time)
    };
}

/** Keeps `document` as a snapshot of Ada's plan, taken `at`. */
const keep = (
    { served, ada, plan }: Awaited<ReturnType<typeof start>>,
    document: Y.Doc,
    at: Date,
    reason: 'scheduled' | 'deleted' = 'scheduled'
) =>
    insertSnapshot(served.db, {
        documentId: plan.id,
        workspaceId: ada.personal.id,
        name: plan.name,
        state: Y.encodeStateAsUpdate(document),
        reason,
        now: at
    });

describe('document history', () => {
    it('snapshots a document as it was before each hour of changes', async () => {
        const started = await start();
        const { served, ada, plan, savedNotes, snapshots, content, later } = started;
        const copy = await open(served, ada.cookie, plan.id);
        const write = (text: string) =>
            copy.transact(() => {
                copy.getText('notes').delete(0, copy.getText('notes').length);
                copy.getText('notes').insert(0, text);
            });

        write('First');
        await savedNotes('First');
        // Nothing was saved before the first save, so there is nothing to go back to.
        expect(await snapshots()).toEqual([]);

        later(10 * 60 * 1000);
        write('Second');
        await savedNotes('Second');
        later(10 * 60 * 1000);
        write('Third');
        await savedNotes('Third');

        // One snapshot, of the content before the second save; the third came within the hour.
        const [first, ...others] = await snapshots();
        expect(others).toEqual([]);
        expect(first).toMatchObject({ reason: 'scheduled', restorable: true });
        expect(notes((await content(first.id)) as Y.Doc)).toBe('First');

        later(HOUR);
        write('Fourth');
        await savedNotes('Fourth');

        const listed = await snapshots();
        expect(listed.map(({ id }) => id).slice(1)).toEqual([first.id]);
        expect(notes((await content(listed[0].id)) as Y.Doc)).toBe('Third');
    });

    it('keeps every snapshot for a day, then the last of each day for 30 days', async () => {
        const started = await start();
        const { served, snapshots, now } = started;
        const at = (ms: number) => new Date(now().getTime() - ms);
        const document = new Y.Doc();

        // 09:00 UTC on the test's day; hours count back from it.
        const recent = [1, 5, 20].map((hours) => at(hours * HOUR));
        const twoDaysAgo = [50, 52, 55].map((hours) => at(hours * HOUR));
        const tenDaysAgo = [10 * DAY + HOUR, 10 * DAY + 2 * HOUR].map(at);
        const tooOld = at(31 * DAY);
        const deletedLongAgo = at(29 * DAY);

        for (const time of [...recent, ...twoDaysAgo, ...tenDaysAgo, tooOld]) {
            await keep(started, document, time);
        }
        await keep(started, document, deletedLongAgo, 'deleted');
        await keep(started, document, at(29 * DAY + HOUR));

        await pruneSnapshots(served.db, now());

        const kept = (await snapshots()).map(({ createdAt }) => new Date(createdAt).getTime());
        expect(kept).toEqual(
            [
                ...recent,
                // The last of each earlier day (in UTC) stays.
                twoDaysAgo[0],
                tenDaysAgo[0],
                deletedLongAgo
            ].map((time) => time.getTime())
        );
    });

    it('restores a snapshot as a change everyone receives, and keeps what it replaced', async () => {
        const started = await start();
        const { served, ada, grace, plan, joinAs, snapshots, restore, now } = started;

        await joinAs('editor');

        const adas = await open(served, ada.cookie, plan.id);
        const graces = await open(served, grace.cookie, plan.id);
        const shapes = adas.getMap<Y.Map<unknown>>('shapes');

        adas.transact(() => {
            const box = new Y.Map<unknown>();
            box.set('x', 1);
            box.set('fill', { color: 'red' });
            shapes.set('box', box);
            adas.getMap('versions').set('31', true);
            adas.getText('notes').insert(0, 'Before');
        });
        await vi.waitFor(() => expect(notes(graces)).toBe('Before'));

        const before = fromState(await served.sync.currentState(plan.id));
        await keep(started, before, now());
        started.later(60 * 1000);

        const box = shapes.get('box')!;
        adas.transact(() => {
            box.set('x', 2);
            box.set('fill', { color: 'blue' });
            shapes.set('circle', new Y.Map());
            adas.getText('notes').insert(6, ' and after');
        });
        await vi.waitFor(() => expect(notes(graces)).toBe('Before and after'));

        const [snapshot] = await snapshots();
        expect((await restore(snapshot.id, grace.cookie)).status).toBe(204);

        for (const copy of [adas, graces]) {
            await vi.waitFor(() => expect(notes(copy)).toBe('Before'));
            expect(copy.getMap('shapes').toJSON()).toEqual({
                box: { x: 1, fill: { color: 'red' } }
            });
        }
        // The same entity was changed back rather than replaced, so edits to it still merge.
        expect(shapes.get('box')).toBe(box);
        expect([...adas.getMap('versions').keys()]).toEqual(['31']);

        // What was replaced is kept, and can be restored in turn.
        const [replaced] = await snapshots();
        expect(replaced).toMatchObject({ reason: 'before-restore' });
        expect((await restore(replaced.id)).status).toBe(204);
        await vi.waitFor(() => expect(notes(graces)).toBe('Before and after'));
        expect(graces.getMap('shapes').toJSON()).toEqual({
            box: { x: 2, fill: { color: 'blue' } },
            circle: {}
        });
    });

    it('restores a document nobody has open, and saves it', async () => {
        const started = await start();
        const { snapshots, restore, saved, now } = started;
        const old = new Y.Doc();

        old.getText('notes').insert(0, 'Old');
        await keep(started, old, now());

        const [snapshot] = await snapshots();
        expect((await restore(snapshot.id)).status).toBe(204);
        expect(notes((await saved())!)).toBe('Old');
    });

    it('refuses to restore a snapshot from a newer format than the server serves', async () => {
        const started = await start({ editorVersion: 31 });
        const { snapshots, restore, now } = started;
        const newer = new Y.Doc();

        newer.getMap('versions').set('32', true);
        await keep(started, newer, now());

        const [snapshot] = await snapshots();
        expect(snapshot).toMatchObject({ version: 32, restorable: false });
        expect((await restore(snapshot.id)).status).toBe(409);
    });

    it('keeps a deleted document, with its unsaved changes and images, for an admin to restore', async () => {
        const started = await start();
        const { served, ada, plan } = started;
        const image = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);
        const hash = createHash('sha256').update(image).digest('hex');

        expect(
            (
                await served.call('PUT', `/documents/${plan.id}/assets/${hash}`, {
                    cookie: ada.cookie,
                    body: image
                })
            ).status
        ).toBe(201);

        const copy = await open(served, ada.cookie, plan.id);
        copy.getText('notes').insert(0, 'Not saved yet');
        await vi.waitFor(async () =>
            expect(notes(fromState(await served.sync.currentState(plan.id)))).toBe('Not saved yet')
        );

        const deleted = () =>
            served.json<Array<{ id: string; name: string }>>(
                served.call('GET', `/workspaces/${ada.personal.id}/deleted-documents`, {
                    cookie: ada.cookie
                })
            );

        expect(await deleted()).toEqual([]);
        expect(
            (await served.call('DELETE', `/documents/${plan.id}`, { cookie: ada.cookie })).status
        ).toBe(204);
        expect(await deleted()).toEqual([
            { id: plan.id, name: 'Plan', deletedAt: expect.any(String) }
        ]);

        // The cleanup of unused images spares the ones a deleted document used.
        await deleteUnusedAssets(served.db, postgresBlobs(served.db), new Date(Date.now() + DAY));

        const restoring = () =>
            served.call(
                'POST',
                `/workspaces/${ada.personal.id}/deleted-documents/${plan.id}/restore`,
                { cookie: ada.cookie }
            );
        const response = await restoring();
        expect(response.status).toBe(201);

        const restored = (await response.json()) as DocumentSummary;
        expect(restored.id).not.toBe(plan.id);
        expect(restored.name).toBe('Plan');
        expect(notes((await started.saved(restored.id))!)).toBe('Not saved yet');
        expect(
            (
                await served.call('GET', `/documents/${restored.id}/assets/${hash}`, {
                    cookie: ada.cookie
                })
            ).status
        ).toBe(200);
        // Its history comes along, and it is no longer listed as deleted.
        expect(
            (
                await served.json<Snapshot[]>(
                    served.call('GET', `/documents/${restored.id}/history`, { cookie: ada.cookie })
                )
            ).map(({ reason }) => reason)
        ).toEqual(['deleted']);
        expect(await deleted()).toEqual([]);
        expect((await restoring()).status).toBe(404);

        // Restored documents are listed like any other.
        const listed = await served.json<DocumentSummary[]>(
            served.call('GET', `/workspaces/${ada.personal.id}/documents`, { cookie: ada.cookie })
        );
        expect(listed.map(({ id }) => id)).toEqual([restored.id]);
    });

    it('lets viewers read the history, editors restore, and only admins see deleted documents', async () => {
        const started = await start();
        const { served, ada, grace, plan, joinAs, history, content, restore, now } = started;
        const old = new Y.Doc();

        old.getText('notes').insert(0, 'Old');
        const id = await keep(started, old, now());
        const deleted = (cookie: string) =>
            served.call('GET', `/workspaces/${ada.personal.id}/deleted-documents`, { cookie });
        const restoreDeleted = (cookie: string) =>
            served.call(
                'POST',
                `/workspaces/${ada.personal.id}/deleted-documents/${plan.id}/restore`,
                { cookie }
            );

        // Someone outside the workspace learns nothing.
        expect((await history(grace.cookie)).status).toBe(404);
        expect(((await content(id, grace.cookie)) as Response).status).toBe(404);
        expect((await restore(id, grace.cookie)).status).toBe(404);
        expect((await deleted(grace.cookie)).status).toBe(404);
        expect((await restoreDeleted(grace.cookie)).status).toBe(404);

        await joinAs('viewer');
        expect((await history(grace.cookie)).status).toBe(200);
        expect(notes((await content(id, grace.cookie)) as Y.Doc)).toBe('Old');
        expect((await restore(id, grace.cookie)).status).toBe(403);
        expect((await deleted(grace.cookie)).status).toBe(403);

        await sql`update workspace_members set role = 'editor'
            where workspace_id = ${ada.personal.id} and role = 'viewer'`.execute(served.db);
        expect((await deleted(grace.cookie)).status).toBe(403);
        expect((await restoreDeleted(grace.cookie)).status).toBe(403);
        expect((await restore(id, grace.cookie)).status).toBe(204);

        // A snapshot is only reached through its own document.
        const other = await started.createIn(ada.personal.id, ada.cookie, 'Other');
        expect((await restore(id, ada.cookie, other.id)).status).toBe(404);
        expect(
            (
                await served.call('GET', `/documents/${other.id}/history/${id}`, {
                    cookie: ada.cookie
                })
            ).status
        ).toBe(404);
        // A restore changes something, so it must come from the editor's site.
        expect(
            (
                await served.call('POST', `/documents/${plan.id}/history/${id}/restore`, {
                    cookie: ada.cookie,
                    headers: { origin: 'https://attacker.example' }
                })
            ).status
        ).toBe(403);
    });

    it("never shows a deleted document's history under a document that took its id elsewhere", async () => {
        const started = await start();
        const { served, ada, grace, plan, createIn, now } = started;

        await keep(started, new Y.Doc(), now());
        await served.call('DELETE', `/documents/${plan.id}`, { cookie: ada.cookie });

        // A client may choose any free id, and a deleted document's id is free again.
        const taken = await createIn(grace.personal.id, grace.cookie, 'Mine', plan.id);
        expect(taken.id).toBe(plan.id);
        expect(
            await served.json(
                served.call('GET', `/documents/${plan.id}/history`, { cookie: grace.cookie })
            )
        ).toEqual([]);
        // Ada's deleted document is still hers to restore.
        expect(
            await served.json<Array<{ id: string }>>(
                served.call('GET', `/workspaces/${ada.personal.id}/deleted-documents`, {
                    cookie: ada.cookie
                })
            )
        ).toMatchObject([{ id: plan.id }]);
        expect(
            (
                await served.call(
                    'POST',
                    `/workspaces/${ada.personal.id}/deleted-documents/${plan.id}/restore`,
                    { cookie: ada.cookie }
                )
            ).status
        ).toBe(201);
    });
});
