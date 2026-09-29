import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import {
    allows,
    createDocument,
    deleteDocument,
    documentsIn,
    ensurePersonalWorkspace,
    roleIn,
    roleOnDocument,
    workspacesOf
} from './workspaces.js';

const refuse = (res, status, code) => res.status(status).json({ code });

/** A document name as given, or undefined when it is not one. */
function nameOf(body) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    return name.length > 0 && name.length <= 200 ? name : undefined;
}

/**
 * The app's API, for signed-in users only. A request that changes anything must
 * come from `origin` and send JSON, so another site cannot make one with the
 * user's cookie. Workspaces and documents the user may not read are answered as
 * missing, so their existence is not revealed.
 */
export function createApi({ db, auth, origin }) {
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
        res.json(await workspacesOf(db, req.userId));
    });

    api.get('/workspaces/:workspaceId/documents', async (req, res) => {
        const role = await roleIn(db, req.userId, req.params.workspaceId);

        if (!allows(role, 'viewer')) {
            return refuse(res, 404, 'NOT_FOUND');
        }

        return res.json(await documentsIn(db, req.params.workspaceId));
    });

    api.post('/workspaces/:workspaceId/documents', async (req, res) => {
        const role = await roleIn(db, req.userId, req.params.workspaceId);

        if (!allows(role, 'viewer')) {
            return refuse(res, 404, 'NOT_FOUND');
        }

        if (!allows(role, 'editor')) {
            return refuse(res, 403, 'FORBIDDEN');
        }

        const name = nameOf(req.body);

        if (!name) {
            return refuse(res, 400, 'INVALID_NAME');
        }

        return res.status(201).json(
            await createDocument(db, {
                workspaceId: req.params.workspaceId,
                name,
                userId: req.userId
            })
        );
    });

    api.delete('/documents/:documentId', async (req, res) => {
        const role = await roleOnDocument(db, req.userId, req.params.documentId);

        if (!allows(role, 'viewer')) {
            return refuse(res, 404, 'NOT_FOUND');
        }

        if (!allows(role, 'admin')) {
            return refuse(res, 403, 'FORBIDDEN');
        }

        await deleteDocument(db, req.params.documentId);

        return res.status(204).end();
    });

    // eslint-disable-next-line no-unused-vars
    api.use((error, req, res, _next) => {
        if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
            return refuse(res, error.status, 'INVALID_BODY');
        }

        req.log?.error(error);

        return refuse(res, 500, 'INTERNAL');
    });

    return api;
}
