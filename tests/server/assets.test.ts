import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import { MAX_ASSET_BYTES } from '../../server/assets';
import { serve, type DocumentSummary } from './support';

type Served = Awaited<ReturnType<typeof serve>>;
type User = Awaited<ReturnType<Served['user']>>;

const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0));
const png = (...content: number[]) =>
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...content]);

const PNG = png(1, 2, 3);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const GIF = new Uint8Array([...ascii('GIF89a'), 1, 2, 3]);
const WEBP = new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), 1, 2, 3]);
const SVG = new Uint8Array(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));

const hashOf = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** A server with Ada signed in and a document of hers, and how assets of a document are called. */
async function serveDocument(options?: Parameters<typeof serve>[0]) {
    const served = await serve(options);
    const ada = await served.user('ada@example.com');
    const createDocument = (name: string, { cookie, personal }: User = ada) =>
        served.json<DocumentSummary>(
            served.call('POST', `/workspaces/${personal.id}/documents`, { cookie, body: { name } })
        );
    const plan = await createDocument('Plan');
    const path = (bytes: Uint8Array, documentId = plan.id) =>
        `/documents/${documentId}/assets/${hashOf(bytes)}`;
    const upload = (bytes: Uint8Array, { cookie = ada.cookie, documentId = plan.id } = {}) =>
        served.call('PUT', path(bytes, documentId), { cookie, body: bytes });
    const read = (bytes: Uint8Array, { cookie = ada.cookie, documentId = plan.id } = {}) =>
        served.call('GET', path(bytes, documentId), { cookie });

    /** Makes `email` a member of Ada's workspace with `role`. */
    const join = async (email: string, role: string) => {
        const { rows } = await sql<{ id: string }>`
            select id from auth.user where email = ${email}`.execute(served.db);

        await sql`insert into workspace_members (workspace_id, user_id, role)
            values (${ada.personal.id}, ${rows[0].id}, ${role})
            on conflict (workspace_id, user_id) do update set role = excluded.role`.execute(
            served.db
        );
    };

    return { ...served, ada, plan, createDocument, path, upload, read, join };
}

const codeOf = async (response: Response) => ((await response.json()) as { code: string }).code;

describe('assets', () => {
    it.each([
        ['PNG', PNG, 'image/png'],
        ['JPEG', JPEG, 'image/jpeg'],
        ['GIF', GIF, 'image/gif'],
        ['WebP', WEBP, 'image/webp']
    ])('keeps a %s for a document and gives it back as that type', async (_, bytes, type) => {
        const { upload, read } = await serveDocument();

        expect((await upload(bytes)).status).toBe(201);

        const response = await read(bytes);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe(type);
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    });

    it('serves an image to be cached for good and never read as another type', async () => {
        const { upload, read } = await serveDocument();

        await upload(PNG);

        const { headers } = await read(PNG);

        expect(headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
        expect(headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('answers an upload repeated as already kept', async () => {
        const { upload } = await serveDocument();

        expect((await upload(PNG)).status).toBe(201);
        expect((await upload(PNG)).status).toBe(200);
    });

    it('refuses what is not an image it takes, SVG too', async () => {
        const { upload, read } = await serveDocument();

        for (const bytes of [SVG, new Uint8Array([1, 2, 3])]) {
            const response = await upload(bytes);

            expect(response.status).toBe(400);
            expect(await codeOf(response)).toBe('INVALID_IMAGE');
            expect((await read(bytes)).status).toBe(404);
        }
    });

    it('refuses bytes that are not the ones the address names', async () => {
        const { call, path, read, ada } = await serveDocument();
        const response = await call('PUT', path(PNG), { cookie: ada.cookie, body: png(9) });

        expect(response.status).toBe(400);
        expect(await codeOf(response)).toBe('HASH_MISMATCH');
        expect((await read(PNG)).status).toBe(404);
        expect(
            (
                await call('PUT', `/documents/${'x'}/assets/not-a-hash`, {
                    cookie: ada.cookie,
                    body: PNG
                })
            ).status
        ).toBe(404);
    });

    it('refuses an image over the size limit', async () => {
        const { upload, read } = await serveDocument();
        const large = new Uint8Array(MAX_ASSET_BYTES + 1);

        large.set(PNG);

        expect((await upload(large)).status).toBe(413);
        expect((await read(large)).status).toBe(404);
    });

    it('refuses a body that is not sent as bytes, and uploads from another site', async () => {
        const { call, path, read, ada } = await serveDocument();
        const send = (headers: Record<string, string>) =>
            call('PUT', path(PNG), { cookie: ada.cookie, body: PNG, headers });

        expect((await send({ 'content-type': 'image/png' })).status).toBe(415);
        expect((await send({ 'content-type': 'application/json' })).status).toBe(415);
        expect((await send({ origin: 'https://attacker.example' })).status).toBe(403);
        expect((await call('PUT', path(PNG), { cookie: ada.cookie })).status).toBe(400);
        expect((await read(PNG)).status).toBe(404);
        // Bytes are taken for assets only.
        expect(
            (
                await call('POST', `/workspaces/${ada.personal.id}/documents`, {
                    cookie: ada.cookie,
                    body: PNG
                })
            ).status
        ).toBe(415);
    });

    it('answers nobody signed out', async () => {
        const { call, path, upload } = await serveDocument();

        await upload(PNG);

        expect((await call('GET', path(PNG))).status).toBe(401);
        expect((await call('PUT', path(PNG), { body: PNG })).status).toBe(401);
    });

    it('follows the document: viewers read, editors upload, others find nothing', async () => {
        const { user, upload, read, join } = await serveDocument();
        const grace = await user('grace@example.com');

        await upload(PNG);

        expect((await read(PNG, grace)).status).toBe(404);
        expect((await upload(JPEG, grace)).status).toBe(404);

        await join('grace@example.com', 'viewer');
        expect((await read(PNG, grace)).status).toBe(200);
        expect((await upload(JPEG, grace)).status).toBe(403);

        await join('grace@example.com', 'editor');
        expect((await upload(JPEG, grace)).status).toBe(201);
    });

    it('gives an image only through a document it was uploaded for', async () => {
        const { user, createDocument, upload, read } = await serveDocument();
        const grace = await user('grace@example.com');
        const mine = await createDocument('Mine', grace);
        const hers = { cookie: grace.cookie, documentId: mine.id };

        await upload(PNG);

        // Knowing the hash grants nothing: the bytes have to be sent.
        expect((await read(PNG, hers)).status).toBe(404);
        expect((await upload(PNG, hers)).status).toBe(201);
        expect((await read(PNG, hers)).status).toBe(200);
    });

    it('stores an image once, whatever number of documents use it', async () => {
        const { db, createDocument, upload } = await serveDocument();
        const other = await createDocument('Other');

        await upload(PNG);
        await upload(PNG, { documentId: other.id });

        const { rows } = await sql<{ blobs: number; links: number }>`
            select (select count(*)::int from asset_blobs) as blobs,
                   (select count(*)::int from document_assets) as links`.execute(db);

        expect(rows).toEqual([{ blobs: 1, links: 2 }]);
    });

    it('stops giving a deleted document’s images', async () => {
        const { db, call, ada, plan, upload, read } = await serveDocument();

        await upload(PNG);
        await call('DELETE', `/documents/${plan.id}`, { cookie: ada.cookie });

        expect((await read(PNG)).status).toBe(404);
        expect((await sql`select 1 from document_assets`.execute(db)).rows).toEqual([]);
    });

    it('refuses images beyond the workspace’s quota, counting each image once', async () => {
        const first = png(1);
        const second = png(2);
        const { createDocument, upload, read } = await serveDocument({
            assetQuota: first.length + second.length
        });
        const other = await createDocument('Other');

        expect((await upload(first)).status).toBe(201);
        expect((await upload(first, { documentId: other.id })).status).toBe(201);
        expect((await upload(second)).status).toBe(201);

        const refused = await upload(png(3));

        expect(refused.status).toBe(413);
        expect(await codeOf(refused)).toBe('QUOTA_EXCEEDED');
        expect((await read(png(3))).status).toBe(404);
    });

    it('keeps no bytes of an image refused over the quota', async () => {
        const { db, upload } = await serveDocument({ assetQuota: PNG.length });

        await upload(PNG);
        await upload(JPEG);

        const { rows } = await sql<{ hash: string }>`select hash from asset_blobs`.execute(db);

        expect(rows).toEqual([{ hash: hashOf(PNG) }]);
    });

    it('lets another document use an image its workspace already counts, even over the quota', async () => {
        const { db, plan, createDocument, upload } = await serveDocument({
            assetQuota: PNG.length
        });
        const other = await createDocument('Other');

        await upload(PNG);
        // As when the quota was larger once.
        await sql`insert into assets (hash, type, size) values ('earlier', 'image/png', 100)`.execute(
            db
        );
        await sql`insert into document_assets (document_id, hash)
            values (${plan.id}, 'earlier')`.execute(db);

        expect((await upload(PNG, { documentId: other.id })).status).toBe(201);
        expect((await upload(JPEG, { documentId: other.id })).status).toBe(413);
    });

    it('counts a quota per workspace', async () => {
        const { user, createDocument, upload } = await serveDocument({ assetQuota: PNG.length });
        const grace = await user('grace@example.com');
        const mine = await createDocument('Mine', grace);

        expect((await upload(PNG)).status).toBe(201);
        expect((await upload(JPEG)).status).toBe(413);
        expect((await upload(JPEG, { cookie: grace.cookie, documentId: mine.id })).status).toBe(
            201
        );
    });
});
