import { isIP } from 'node:net';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import type { RequestHandler } from 'express';

const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);

function origin(value: string) {
    const url = new URL(value);
    if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.href !== `${url.origin}/` ||
        url.username ||
        url.password
    ) {
        throw new Error('Preview configuration requires an origin without a path or credentials.');
    }

    return url;
}

/** A deliberately conservative site check; deployments on multi-label public suffixes
 * must choose a preview domain with a different final two labels from the editor. */
export function previewConfiguration(env: NodeJS.ProcessEnv) {
    if (!env.PREVIEW_ORIGIN) {
        return null;
    }
    const editor = origin(env.EDITOR_ORIGIN ?? env.BETTER_AUTH_URL ?? '');
    const preview = origin(env.PREVIEW_ORIGIN);
    const local =
        env.PREVIEW_ALLOW_LOCALHOST === 'true' &&
        loopback(editor.hostname) &&
        loopback(preview.hostname);
    const site = (url: URL) => url.hostname.split('.').slice(-2).join('.');
    if (
        editor.origin === preview.origin ||
        (!local &&
            (editor.protocol !== 'https:' ||
                preview.protocol !== 'https:' ||
                site(editor) === site(preview) ||
                isIP(preview.hostname) !== 0 ||
                preview.hostname.startsWith('[') ||
                loopback(editor.hostname) ||
                loopback(preview.hostname) ||
                preview.hostname.split('.').length < 3))
    ) {
        throw new Error(
            'Preview requires HTTPS on a separate site with an app subdomain. Local testing requires PREVIEW_ALLOW_LOCALHOST=true and distinct loopback origins.'
        );
    }

    return { editorOrigin: editor.origin, previewOrigin: preview.origin, local };
}

export const previewConfigHandler =
    (config: ReturnType<typeof previewConfiguration>): RequestHandler =>
    (_req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json({ origin: config?.previewOrigin ?? null });
    };

/** Static runtime only: no account, document, API or asset endpoints. */
export function previewServer(
    directory: string,
    config: NonNullable<ReturnType<typeof previewConfiguration>>
) {
    const app = express();
    app.disable('x-powered-by');
    app.use(
        helmet({
            contentSecurityPolicy: {
                useDefaults: false,
                directives: {
                    defaultSrc: ["'none'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ['data:'],
                    connectSrc: ["'none'"],
                    baseUri: ["'none'"],
                    formAction: ["'none'"],
                    objectSrc: ["'none'"],
                    frameAncestors: [config.editorOrigin],
                    ...(config.local ? {} : { upgradeInsecureRequests: [] })
                }
            },
            frameguard: false,
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            crossOriginEmbedderPolicy: false
        })
    );
    app.use(compression());
    app.get('/healthz', (_req, res) => {
        res.json({ ok: true });
    });
    app.get('/configuration.js', (_req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.type('application/javascript').send(
            `window.REACTOR_EDITOR_ORIGIN=${JSON.stringify(config.editorOrigin)};`
        );
    });
    app.use(
        express.static(directory, {
            setHeaders(res, file) {
                res.setHeader(
                    'Cache-Control',
                    /\.[a-f0-9]+\.(js|css)$/.test(file)
                        ? 'public, max-age=31536000, immutable'
                        : 'no-cache'
                );
            }
        })
    );
    app.use((_req, res) => {
        res.sendStatus(404);
    });

    return app;
}
