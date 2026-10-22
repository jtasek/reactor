import { previewConfiguration, previewConfigHandler } from './server/preview.ts';
import path, { dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { pinoHttp } from 'pino-http';

import { startAccounts } from './server/accounts.ts';
import { healthCheck, notFound, PAGE_FILE, parsePort, serveBuild } from './server/pages.ts';
import { parseTrustProxy } from './server/trustProxy.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HOST = process.env.HOST ?? '0.0.0.0';
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

const DIST_DIR = path.join(__dirname, 'dist');
const STATIC_DIR = path.join(__dirname, 'static');
const INDEX_HTML = path.join(DIST_DIR, PAGE_FILE);

let PORT = 4000;
// The reverse proxies in front of this server, as `parseTrustProxy` reads them. Required
// for correct client IPs and for Secure/HSTS behaviour behind a TLS-terminating proxy.
let TRUST_PROXY: ReturnType<typeof parseTrustProxy> = false;

try {
    PORT = parsePort(process.env.PORT);
    TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY);
} catch (err) {
    console.error((err as Error).message);
    process.exit(1);
}

if (!fs.existsSync(INDEX_HTML)) {
    console.error(`Build output not found at ${INDEX_HTML}. Run "pnpm build" first.`);
    process.exit(1);
}

// With accounts, documents sync over a WebSocket on the editor's own address,
// which some browsers do not count as 'self'.
const SYNC_ORIGIN =
    process.env.DATABASE_URL && process.env.BETTER_AUTH_URL
        ? new URL(process.env.BETTER_AUTH_URL).origin.replace(/^http/, 'ws')
        : undefined;

const logger = pinoHttp({
    level: LOG_LEVEL,
    // Health-check probes are high-volume and low-signal; do not log them.
    autoLogging: { ignore: (req) => req.url === '/healthz' }
});

/** Where Google and GitHub, the optional sign-in providers, keep profile photos. */
const PROFILE_PHOTO_HOSTS = [
    'https://*.googleusercontent.com',
    'https://avatars.githubusercontent.com'
];

const PREVIEW = previewConfiguration(process.env);
const app = express();

// Behind a load balancer / reverse proxy this lets Express trust X-Forwarded-* headers.
app.set('trust proxy', TRUST_PROXY);
app.disable('x-powered-by');
app.disable('etag');

app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                defaultSrc: ["'self'"],
                baseUri: ["'none'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
                frameSrc: PREVIEW ? [PREVIEW.previewOrigin] : ["'none'"],
                formAction: ["'self'"],
                scriptSrc: ["'self'"],
                // React renders dynamic inline style attributes (shape positions,
                // sizes, colors) so style-src needs 'unsafe-inline'. Scripts remain locked down.
                styleSrc: ["'self'", "'unsafe-inline'"],
                // Account photos come from the sign-in providers' own image hosts.
                imgSrc: ["'self'", 'data:', 'blob:', ...PROFILE_PHOTO_HOSTS],
                fontSrc: ["'self'", 'data:'],
                connectSrc: ["'self'", ...(SYNC_ORIGIN ? [SYNC_ORIGIN] : [])],
                manifestSrc: ["'self'"],
                workerSrc: ["'self'", 'blob:'],
                upgradeInsecureRequests: []
            }
        },
        crossOriginEmbedderPolicy: false,
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
    })
);

app.use(compression());
app.use(logger);

app.get('/api/preview-config', previewConfigHandler(PREVIEW));

app.get('/healthz', healthCheck(DIST_DIR));

let accounts: Awaited<ReturnType<typeof startAccounts>>;

try {
    accounts = await startAccounts(process.env, { production: true, log: logger.logger });
} catch (err) {
    logger.logger.error(err, 'Accounts could not be started');
    process.exit(1);
}

// Before any body parser, which would consume the request Better Auth reads.
if (accounts) {
    app.all('/api/auth/*splat', accounts.handler);
    app.use('/api', accounts.api);
}

// Anything else under /api is unknown, including accounts when they are off.
app.all('/api/*splat', (_req, res) => {
    res.status(404).json({ code: 'NOT_FOUND' });
});

// Static asset folders referenced by absolute URLs in the app (not content-hashed).
const assetOptions = { maxAge: '1d', index: false, redirect: false };
app.use('/icons', express.static(path.join(STATIC_DIR, 'icons'), assetOptions));
app.use('/images', express.static(path.join(STATIC_DIR, 'images'), assetOptions));
// The hashed bundles use the design tokens these stylesheets define, so a browser checks
// them again on every load rather than pairing new bundles with yesterday's tokens.
app.use(
    '/styles',
    express.static(path.join(STATIC_DIR, 'styles'), {
        ...assetOptions,
        setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache')
    })
);

app.use(serveBuild(DIST_DIR));
app.use(notFound);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    req.log?.error(err);
    res.status(500).type('text/plain').send('Internal Server Error');
});

const server = app.listen(PORT, HOST, () => {
    logger.logger.info(`Production server listening on http://${HOST}:${PORT}`);
});

accounts?.sync.attach(server);

server.on('error', (err) => {
    logger.logger.error(err);
    process.exit(1);
});

const shutdown = (signal: string) => {
    logger.logger.info(`Received ${signal}, shutting down gracefully`);
    // Closing the sync disconnects its sockets, which would keep the server open,
    // and saves the documents open here before the database closes.
    const synced = Promise.resolve(accounts?.sync.close());

    server.close(() => {
        synced.then(() => accounts?.close()).finally(() => process.exit(0));
    });
    // Force-exit if connections do not drain in time.
    setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
