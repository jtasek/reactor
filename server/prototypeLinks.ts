import express, { type Request } from 'express';
import type { Db } from './schema.ts';
import { createPrototypeLinkService, type ShareProblem } from './services/prototypeLinks.ts';

const PATH = '/documents/:documentId/prototype-links';
const STATUS: Record<ShareProblem, number> = {
    NOT_FOUND: 404,
    FORBIDDEN: 403,
    INVALID_SNAPSHOT: 400,
    SHARE_LIMIT: 409
};

export const sendsPrototypeSnapshot = (req: Request) =>
    req.method === 'POST' && /^\/documents\/[^/]+\/prototype-links$/.test(req.path);

/** Mounted before cookie authentication: the random capability grants this snapshot only. */
export function publicPrototypeLinks(db: Db, previewOrigin?: string) {
    const api = express.Router();
    const service = createPrototypeLinkService(db);
    api.use('/prototype-links/open', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        res.set('Referrer-Policy', 'no-referrer');
        res.set('Vary', 'Origin');
        if (!previewOrigin || req.headers.origin !== previewOrigin) {
            res.status(403).json({ code: 'INVALID_ORIGIN' });

            return;
        }
        res.set('Access-Control-Allow-Origin', previewOrigin);
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.sendStatus(204);

            return;
        }

        next();
    });
    api.post('/prototype-links/open', express.json({ limit: '1kb' }), async (req, res) => {
        const snapshot = await service.open(req.body?.token);
        if (!snapshot) {
            res.status(404).json({ code: 'NOT_FOUND' });

            return;
        }
        res.type('application/json').send(snapshot);
    });

    return api;
}

/** Authenticated management; SQL and authorization policy live outside the router. */
export function prototypeLinks(db: Db, previewOrigin?: string) {
    const api = express.Router();
    const service = createPrototypeLinkService(db);
    api.use(PATH, (_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });
    api.get(PATH, async (req, res) => {
        const result = await service.list(req.userId, req.params.documentId);
        if (!result.ok) {
            res.status(STATUS[result.problem]).json({ code: result.problem });

            return;
        }
        res.json(result.links);
    });
    api.post(PATH, express.json({ limit: '24mb' }), async (req, res) => {
        if (!previewOrigin) {
            res.status(503).json({ code: 'PREVIEW_UNAVAILABLE' });

            return;
        }
        const result = await service.create(req.userId, req.params.documentId, req.body);
        if (!result.ok) {
            res.status(STATUS[result.problem]).json({ code: result.problem });

            return;
        }
        res.status(201).json({ ...result.link, url: `${previewOrigin}/share#${result.token}` });
    });
    api.delete(`${PATH}/:linkId`, async (req, res) => {
        const result = await service.revoke(req.userId, req.params.documentId, req.params.linkId);
        if (!result.ok) {
            res.status(STATUS[result.problem]).json({ code: result.problem });

            return;
        }
        res.sendStatus(204);
    });

    return api;
}
