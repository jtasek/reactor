import path, { dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
// Number of trusted reverse-proxy hops in front of this server. Required for
// correct client IPs and for Secure/HSTS behaviour behind a TLS-terminating proxy.
const TRUST_PROXY = process.env.TRUST_PROXY ?? false;

const DIST_DIR = path.join(__dirname, 'dist');
const STATIC_DIR = path.join(__dirname, 'static');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    console.error(`Invalid PORT: ${process.env.PORT}`);
    process.exit(1);
}

if (!fs.existsSync(INDEX_HTML)) {
    console.error(`Build output not found at ${INDEX_HTML}. Run "pnpm build" first.`);
    process.exit(1);
}

const logger = pinoHttp({
    level: LOG_LEVEL,
    // Health-check probes are high-volume and low-signal; do not log them.
    autoLogging: { ignore: (req) => req.url === '/healthz' }
});

const app = express();

// Behind a load balancer / reverse proxy this lets Express trust X-Forwarded-* headers.
app.set('trust proxy', TRUST_PROXY === 'false' ? false : TRUST_PROXY === 'true' ? true : TRUST_PROXY);
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
                formAction: ["'self'"],
                scriptSrc: ["'self'"],
                // React renders dynamic inline style attributes (shape positions,
                // sizes, colors) so style-src needs 'unsafe-inline'. Scripts remain locked down.
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
                fontSrc: ["'self'", 'data:'],
                connectSrc: ["'self'"],
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

app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

const setStaticCache = (res, filePath) => {
    if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
    } else {
        // dist assets carry a content hash in the filename, so they are immutable.
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
};

// Static asset folders referenced by absolute URLs in the app (not content-hashed).
const assetOptions = { maxAge: '1d', index: false, redirect: false };
app.use('/icons', express.static(path.join(STATIC_DIR, 'icons'), assetOptions));
app.use('/images', express.static(path.join(STATIC_DIR, 'images'), assetOptions));
app.use('/styles', express.static(path.join(STATIC_DIR, 'styles'), assetOptions));

// Hashed build output (JS/CSS) and index.html.
app.use(
    express.static(DIST_DIR, {
        index: false,
        redirect: false,
        setHeaders: setStaticCache
    })
);

// SPA fallback: serve index.html for client-side routes (e.g. /documents),
// but let requests for missing files (anything with an extension) 404 properly.
app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.set('Allow', 'GET, HEAD');
        return res.status(405).type('text/plain').send('Method Not Allowed');
    }
    if (path.extname(req.path)) {
        return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(INDEX_HTML);
});

app.use((_req, res) => {
    res.status(404).type('text/plain').send('Not Found');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
    req.log?.error(err);
    res.status(500).type('text/plain').send('Internal Server Error');
});

const server = app.listen(PORT, HOST, () => {
    logger.logger.info(`Production server listening on http://${HOST}:${PORT}`);
});

server.on('error', (err) => {
    logger.logger.error(err);
    process.exit(1);
});

const shutdown = (signal) => {
    logger.logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(() => process.exit(0));
    // Force-exit if connections do not drain in time.
    setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
