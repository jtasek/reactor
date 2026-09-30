import path from 'node:path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Serves the editor's page for its routes, such as `/documents`, with `sendPage`.
 * A request for a file that was not found (a path with an extension) is left for
 * the not-found handler, and other methods than GET and HEAD are refused.
 */
export function pageFallback(
    sendPage: (req: Request, res: Response, next: NextFunction) => void
): RequestHandler {
    return (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.set('Allow', 'GET, HEAD');
            res.status(405).type('text/plain').send('Method Not Allowed');

            return;
        }

        if (path.extname(req.path)) {
            next();

            return;
        }

        sendPage(req, res, next);
    };
}

/** Answers what nothing else did. */
export const notFound: RequestHandler = (_req, res) => {
    res.status(404).type('text/plain').send('Not Found');
};

/** The port from `PORT`, 4000 when unset; throws on one a server cannot listen on. */
export function parsePort(value: string | undefined): number {
    const port = Number(value ?? 4000);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid PORT: ${value}`);
    }

    return port;
}
