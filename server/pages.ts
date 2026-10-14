import { access } from 'node:fs/promises';
import path from 'node:path';
import type { ServerResponse } from 'node:http';
import express, {
    type NextFunction,
    type Request,
    type RequestHandler,
    type Response
} from 'express';

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

/** The editor's page, as the build writes it into its output directory. */
export const PAGE_FILE = 'index.html';

const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

export const IMMUTABLE_CACHE_CONTROL = `public, max-age=${ONE_YEAR_IN_SECONDS}, immutable`;

const setStaticCache = (res: ServerResponse, filePath: string) => {
    if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');

        return;
    }

    // dist assets carry a content hash in the filename, so they are immutable.
    res.setHeader('Cache-Control', IMMUTABLE_CACHE_CONTROL);
};

/**
 * Serves the build output in `directory`: its files, and its page for the editor's routes,
 * which are left to the next handler while the page is missing, as during a rebuild, marked
 * `no-store` so that no cache keeps the miss. Both are sent with `directory` as their root,
 * since Express refuses a path through a dot-directory, as a checkout under
 * `.claude/worktrees` has, unless it lies above the root.
 */
export function serveBuild(directory: string): RequestHandler {
    const files = express.static(directory, {
        index: false,
        redirect: false,
        setHeaders: setStaticCache
    });

    return express
        .Router()
        .use(files)
        .use(
            pageFallback((req, res, next) => {
                const url = req.url;

                req.url = `/${PAGE_FILE}`;
                files(req, res, (err?: unknown) => {
                    req.url = url;
                    res.setHeader('Cache-Control', 'no-store');
                    next(err);
                });
            })
        );
}

/**
 * Answers the health check: ok while the build output in `directory` has its page, and 503
 * while it has none, as the editor's routes are then not found.
 */
export function healthCheck(directory: string): RequestHandler {
    const page = path.join(directory, PAGE_FILE);

    return async (_req, res) => {
        const uptime = process.uptime();

        try {
            await access(page);
        } catch {
            res.status(503).json({ status: 'missing page', uptime });

            return;
        }

        res.json({ status: 'ok', uptime });
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
