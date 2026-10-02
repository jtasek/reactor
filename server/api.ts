import express, { type NextFunction, type Request, type Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import {
    MAX_ASSET_BYTES,
    WORKSPACE_ASSET_BYTES,
    addDocumentAsset,
    assetHash,
    documentAsset,
    imageType,
    isAssetHash,
    postgresBlobs,
    type BlobStorage
} from './assets.ts';
import {
    allows,
    createDocument,
    deleteDocument,
    listDocuments,
    ensurePersonalWorkspace,
    workspaceRole,
    documentRole,
    listWorkspaces
} from './workspaces.ts';
import type { Auth } from './auth.ts';
import type { Db, Log } from './schema.ts';

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            /** Who is signed in, set once the session is read. */
            userId: string;
            /** The request's logger, where the server logs requests. */
            log?: Log;
        }
    }
}

const refuse = (res: Response, status: number, code: string) => {
    res.status(status).json({ code });
};

/** A document name as given, or undefined when it is not one. */
function parseName(body: { name?: unknown } | undefined) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    return name.length > 0 && name.length <= 200 ? name : undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

const ASSET = '/documents/:documentId/assets/:hash';

const BYTES = 'application/octet-stream';

/** Whether the request uploads an asset, the one that sends bytes. */
const uploadsAsset = (req: Request) =>
    req.method === 'PUT' && /^\/documents\/[^/]+\/assets\/[^/]+$/.test(req.path);

/**
 * The app's API, for signed-in users only. A request that changes anything must
 * come from `origin` and send JSON, or an image as bytes, so another site cannot
 * make one with the user's cookie. Workspaces and documents the user may not read are answered as
 * missing, so their existence is not revealed.
 */
export function createApi({
    db,
    auth,
    origin,
    onDeleted = () => {},
    blobs = postgresBlobs(db),
    assetQuota = WORKSPACE_ASSET_BYTES
}: {
    db: Db;
    auth: Auth;
    origin: string;
    onDeleted?: (documentId: string) => void;
    blobs?: BlobStorage;
    /** The bytes of images a workspace's documents may use together. */
    assetQuota?: number;
}) {
    const api = express.Router();

    api.use((req, res, next) => {
        if (req.method === 'GET' || req.method === 'HEAD') {
            return next();
        }

        if (req.headers.origin !== origin) {
            return refuse(res, 403, 'INVALID_ORIGIN');
        }

        const hasBody =
            Number(req.headers['content-length'] ?? 0) > 0 ||
            req.headers['transfer-encoding'] !== undefined;

        if (uploadsAsset(req)) {
            return hasBody && !req.is(BYTES) ? refuse(res, 415, 'BYTES_REQUIRED') : next();
        }

        if (hasBody && !req.is('application/json')) {
            return refuse(res, 415, 'JSON_REQUIRED');
        }

        return next();
    });
    api.use(express.json({ limit: '16kb' }));
    api.use(async (req, res, next) => {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

        if (!session) {
            return refuse(res, 401, 'UNAUTHORIZED');
        }

        req.userId = session.user.id;

        return next();
    });

    api.get('/workspaces', async (req, res) => {
        await ensurePersonalWorkspace(db, req.userId);
        res.json(await listWorkspaces(db, req.userId));
    });

    api.get('/workspaces/:workspaceId/documents', async (req, res) => {
        const role = await workspaceRole(db, req.userId, req.params.workspaceId);

        if (!allows(role, 'viewer')) {
            return refuse(res, 404, 'NOT_FOUND');
        }

        res.json(await listDocuments(db, req.params.workspaceId));
    });

    api.post('/workspaces/:workspaceId/documents', async (req, res) => {
        const role = await workspaceRole(db, req.userId, req.params.workspaceId);

        if (!allows(role, 'viewer')) {
            return refuse(res, 404, 'NOT_FOUND');
        }

        if (!allows(role, 'editor')) {
            return refuse(res, 403, 'FORBIDDEN');
        }

        const name = parseName(req.body);
        // Chosen by the client, so a document created offline keeps its id.
        const id = req.body?.id;

        if (!name) {
            return refuse(res, 400, 'INVALID_NAME');
        }

        if (id !== undefined && !isUuid(id)) {
            return refuse(res, 400, 'INVALID_ID');
        }

        const result = await createDocument(db, {
            id,
            workspaceId: req.params.workspaceId,
            name,
            userId: req.userId
        });

        if ('conflict' in result) {
            return refuse(res, 409, 'ID_TAKEN');
        }

        res.status(result.created ? 201 : 200).json(result.document);
    });

    api.delete('/documents/:documentId', async (req, res) => {
        const role = await documentRole(db, req.userId, req.params.documentId);

        if (!allows(role, 'viewer')) {
            return refuse(res, 404, 'NOT_FOUND');
        }

        if (!allows(role, 'admin')) {
            return refuse(res, 403, 'FORBIDDEN');
        }

        await deleteDocument(db, req.params.documentId);
        onDeleted(req.params.documentId);

        res.status(204).end();
    });

    api.put(
        ASSET,
        async (req, res, next) => {
            const role = isAssetHash(req.params.hash)
                ? await documentRole(db, req.userId, req.params.documentId)
                : undefined;

            if (!allows(role, 'viewer')) {
                return refuse(res, 404, 'NOT_FOUND');
            }

            if (!allows(role, 'editor')) {
                return refuse(res, 403, 'FORBIDDEN');
            }

            return next();
        },
        // Read only once the user may upload, so nobody else makes the server hold bytes.
        express.raw({ type: BYTES, limit: MAX_ASSET_BYTES }),
        async (req, res) => {
            const bytes: unknown = req.body;
            const type = Buffer.isBuffer(bytes) ? imageType(bytes) : null;

            if (!Buffer.isBuffer(bytes) || !type) {
                return refuse(res, 400, 'INVALID_IMAGE');
            }

            if (assetHash(bytes) !== req.params.hash) {
                return refuse(res, 400, 'HASH_MISMATCH');
            }

            const added = await addDocumentAsset(db, blobs, {
                documentId: req.params.documentId,
                hash: req.params.hash,
                type,
                bytes,
                quota: assetQuota
            });

            switch (added) {
                case 'added':
                    return res.status(201).end();
                case 'alreadyThere':
                    return res.status(200).end();
                case 'overQuota':
                    return refuse(res, 413, 'QUOTA_EXCEEDED');
                case 'noDocument':
                    return refuse(res, 404, 'NOT_FOUND');
            }
        }
    );

    api.get(ASSET, async (req, res) => {
        const role = await documentRole(db, req.userId, req.params.documentId);
        const asset = allows(role, 'viewer')
            ? await documentAsset(db, blobs, req.params.documentId, req.params.hash)
            : undefined;

        if (!asset) {
            return refuse(res, 404, 'NOT_FOUND');
        }

        // Named by its content, an image never changes; it is shown as an image only.
        res.set({
            'Content-Type': asset.type,
            'Cache-Control': 'private, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff'
        });
        res.end(asset.bytes);
    });

    api.use(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (error: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
            const status = error.status ?? 500;

            // The body parser marks a request at fault with its 4xx status.
            if (status >= 400 && status < 500) {
                return refuse(res, status, 'INVALID_BODY');
            }

            (req.log ?? console).error(error);

            refuse(res, 500, 'INTERNAL');
        }
    );

    return api;
}
