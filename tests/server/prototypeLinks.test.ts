import { sql } from 'kysely';
import { serve, type DocumentSummary } from './support';
import { PREVIEW_PROTOCOL_VERSION } from '../../src/preview/protocol';

const PREVIEW = 'https://app.prototype.test';
function application(documentId: string) {
    return {
        documentId,
        images: {},
        screens: [
            {
                id: 'details',
                name: 'Details',
                x: 0,
                y: 0,
                width: 390,
                height: 844,
                nodes: [
                    {
                        key: 'caption',
                        tag: 'text',
                        attrs: { x: 10, y: 30, fill: '#112233' },
                        text: 'Shared snapshot'
                    }
                ]
            },
            { id: 'home', name: 'Home', x: 0, y: 0, width: 390, height: 844, nodes: [] }
        ]
    };
}

async function setup() {
    const server = await serve({ previewOrigin: PREVIEW });
    const admin = await server.user('admin@example.com');
    const document = await server.json<DocumentSummary>(
        server.call('POST', `/workspaces/${admin.personal.id}/documents`, {
            cookie: admin.cookie,
            body: { name: 'App' }
        })
    );
    const path = `/documents/${document.id}/prototype-links`;
    const create = (
        body: unknown = { name: 'Mobile dark', application: application(document.id) },
        cookie = admin.cookie
    ) => server.call('POST', path, { cookie, body });
    const open = (token: string, origin = PREVIEW) =>
        server.call('POST', '/prototype-links/open', { body: { token }, headers: { origin } });

    return { ...server, admin, document, path, create, open };
}

it('publishes a validated immutable snapshot, opens without cookies and revokes it', async () => {
    const server = await setup();
    const response = await server.create();
    expect(response.status).toBe(201);
    const link = await response.json();
    const token = new URL(link.url).hash.slice(1);
    expect(link.url).toMatch(/^https:\/\/app.prototype.test\/share#[A-Za-z0-9_-]{43}$/);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const row = await server.db.selectFrom('prototype_links').selectAll().executeTakeFirstOrThrow();
    expect(row.token_hash).not.toContain(token);
    expect(row.snapshot).not.toContain(token);
    const opened = await server.open(token);
    expect(opened.status).toBe(200);
    expect(opened.headers.get('access-control-allow-origin')).toBe(PREVIEW);
    expect(opened.headers.get('access-control-allow-credentials')).toBeNull();
    expect(opened.headers.get('cache-control')).toBe('no-store');
    const snapshot = await opened.json();
    expect(snapshot.version).toBe(PREVIEW_PROTOCOL_VERSION);
    expect(snapshot.application.documentId).toBe(link.id);
    expect(snapshot.application.screens.map((screen: { id: string }) => screen.id)).toEqual([
        'details',
        'home'
    ]);
    expect(snapshot.application.screens[0]).toMatchObject({ width: 390, height: 844 });

    await server.db
        .updateTable('documents')
        .set({ name: 'Changed private document' })
        .where('id', '=', server.document.id)
        .execute();
    expect(await (await server.open(token)).json()).toEqual(snapshot);
    const list = await (
        await server.call('GET', server.path, { cookie: server.admin.cookie })
    ).json();
    expect(list).toHaveLength(1);
    expect(list[0].url).toBeUndefined();
    expect(list[0].token_hash).toBeUndefined();
    expect(
        (await server.call('DELETE', `${server.path}/${link.id}`, { cookie: server.admin.cookie }))
            .status
    ).toBe(204);
    expect((await server.open(token)).status).toBe(404);
});

it('requires admin access and the editor origin for every management operation', async () => {
    const server = await setup();
    const member = await server.user('member@example.com');
    const outsider = await server.user('outsider@example.com');
    const person = await sql<{
        id: string;
    }>`select id from auth."user" where email = 'member@example.com'`.execute(server.db);
    await server.db
        .insertInto('workspace_members')
        .values({
            workspace_id: server.admin.personal.id,
            user_id: person.rows[0].id,
            role: 'editor'
        })
        .execute();
    const link = await (await server.create()).json();
    for (const role of ['editor', 'viewer'] as const) {
        await server.db
            .updateTable('workspace_members')
            .set({ role })
            .where('user_id', '=', person.rows[0].id)
            .where('workspace_id', '=', server.admin.personal.id)
            .execute();
        expect((await server.create(undefined, member.cookie)).status).toBe(403);
        expect((await server.call('GET', server.path, { cookie: member.cookie })).status).toBe(403);
        expect(
            (await server.call('DELETE', `${server.path}/${link.id}`, { cookie: member.cookie }))
                .status
        ).toBe(403);
    }
    expect((await server.create(undefined, outsider.cookie)).status).toBe(404);
    expect((await server.call('POST', server.path, { body: {} })).status).toBe(401);
    expect(
        (
            await server.call('POST', server.path, {
                cookie: server.admin.cookie,
                body: {},
                headers: { origin: 'https://evil.test' }
            })
        ).status
    ).toBe(403);
    expect((await server.open(new URL(link.url).hash.slice(1), 'https://evil.test')).status).toBe(
        403
    );
    expect(
        (await server.call('OPTIONS', '/prototype-links/open', { headers: { origin: PREVIEW } }))
            .status
    ).toBe(204);
});

it('rejects unsafe snapshots, foreign document IDs, expired and unknown capabilities', async () => {
    const server = await setup();
    const unsafe = application(server.document.id);
    Object.assign(unsafe.screens[0].nodes[0].attrs, { onclick: 'alert(1)' });
    for (const body of [
        { name: 'Unsafe', application: unsafe },
        { name: 'Wrong document', application: application('other-document') },
        { name: 'Empty', application: { ...application(server.document.id), screens: [] } },
        { name: '', application: application(server.document.id) }
    ]) {
        expect((await server.create(body)).status).toBe(400);
    }
    const link = await (await server.create()).json();
    await server.db
        .updateTable('prototype_links')
        .set({ expires_at: new Date(0) })
        .where('id', '=', link.id)
        .execute();
    expect((await server.open(new URL(link.url).hash.slice(1))).status).toBe(404);
    expect((await server.open('x'.repeat(43))).status).toBe(404);
    expect((await server.open('invalid')).status).toBe(404);
    expect(
        await (await server.call('GET', server.path, { cookie: server.admin.cookie })).json()
    ).toEqual([]);
});

it('retains embedded raster images and cascades revocation when the document is deleted', async () => {
    const server = await setup();
    const drawing = application(server.document.id);
    const hash = 'a'.repeat(64);
    const image = 'data:image/png;base64,iVBORw0KGgo=';
    const withImage = {
        ...drawing,
        images: { [hash]: image },
        screens: [
            {
                ...drawing.screens[0],
                nodes: [
                    {
                        key: 'picture',
                        tag: 'image',
                        image: hash,
                        attrs: { x: 0, y: 0, width: 10, height: 10 }
                    }
                ]
            }
        ]
    };
    const response = await server.create({ name: 'Image', application: withImage });
    expect(response.status).toBe(201);
    const link = await response.json();
    const token = new URL(link.url).hash.slice(1);
    expect((await (await server.open(token)).json()).application.images[hash]).toBe(image);
    await server.call('DELETE', `/documents/${server.document.id}`, {
        cookie: server.admin.cookie
    });
    expect((await server.open(token)).status).toBe(404);
});

it('bounds retained snapshots and recovers capacity after revocation', async () => {
    const server = await setup();
    const links = [];
    for (let index = 0; index < 20; index++) {
        const response = await server.create();
        expect(response.status).toBe(201);
        links.push(await response.json());
    }
    expect((await server.create()).status).toBe(409);
    await server.call('DELETE', `${server.path}/${links[0].id}`, { cookie: server.admin.cookie });
    expect((await server.create()).status).toBe(201);
});

it('enforces the workspace byte limit and releases expired snapshot storage', async () => {
    const server = await setup();
    const link = await (await server.create()).json();
    await server.db
        .updateTable('prototype_links')
        .set({ size: 64 * 1024 * 1024 })
        .where('id', '=', link.id)
        .execute();
    expect((await server.create()).status).toBe(409);
    await server.db
        .updateTable('prototype_links')
        .set({ expires_at: new Date(0) })
        .where('id', '=', link.id)
        .execute();
    expect((await server.create()).status).toBe(201);
    expect(
        await server.db
            .selectFrom('prototype_links')
            .select('id')
            .where('id', '=', link.id)
            .executeTakeFirst()
    ).toBeUndefined();
});
