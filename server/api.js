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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const isUuid = (value) => typeof value === 'string' && UUID.test(value);

/**
 * The app's API, for signed-in users only. A request that changes anything must
 * come from `origin` and send JSON, so another site cannot make one with the
 * user's cookie. Workspaces and documents the user may not read are answered as
 * missing, so their existence is not revealed.
 */
export function createApi({ db, auth, origin, onDeleted = () => {} }) {
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

        if (result.conflict) {
            return refuse(res, 409, 'ID_TAKEN');
        }

        return res.status(result.created ? 201 : 200).json(result.document);
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
        onDeleted(req.params.documentId);

        return res.status(204).end();
    });

    // eslint-disable-next-line no-unused-vars
    api.use((error, req, res, _next) => {
        // The body parser marks a request at fault with its 4xx status.
        if (error.status >= 400 && error.status < 500) {
            return refuse(res, error.status, 'INVALID_BODY');
        }

        (req.log ?? console).error(error);

        return refuse(res, 500, 'INTERNAL');
    });

    return api;
}
