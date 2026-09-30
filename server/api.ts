import express, { type NextFunction, type Request, type Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
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

/**
 * The app's API, for signed-in users only. A request that changes anything must
 * come from `origin` and send JSON, so another site cannot make one with the
 * user's cookie. Workspaces and documents the user may not read are answered as
 * missing, so their existence is not revealed.
 */
export function createApi({
    db,
    auth,
    origin,
    onDeleted = () => {}
}: {
    db: Db;
    auth: Auth;
    origin: string;
    onDeleted?: (documentId: string) => void;
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
