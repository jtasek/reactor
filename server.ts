import path, { dirname } from 'path';
import express from 'express';
import webpack from 'webpack';
import webpackMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import { config } from './webpack.config.mjs';
import { fileURLToPath } from 'url';
import { startAccounts } from './server/accounts.ts';
import { notFound, pageFallback, parsePort } from './server/pages.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { HOST = 'localhost' } = process.env;
let PORT = 4000;

try {
    PORT = parsePort(process.env.PORT);
} catch (err) {
    console.error((err as Error).message);
    process.exit(1);
}

const app = express();
const compiler = webpack(config);
const accounts = await startAccounts(process.env, { production: false, log: console });

// Before any body parser, which would consume the request Better Auth reads.
if (accounts) {
    app.all('/api/auth/*splat', accounts.handler);
    app.use('/api', accounts.api);
}

// Anything else under /api is unknown, including accounts when they are off.
app.all('/api/*splat', (_req, res) => {
    res.status(404).json({ code: 'NOT_FOUND' });
});

const devMiddleware = webpackMiddleware(compiler, {
    publicPath: config.output?.publicPath,
    stats: { colors: true }
});
const hotMiddleware = webpackHotMiddleware(compiler);

app.use(devMiddleware);
app.use(hotMiddleware);

app.use('/icons', express.static(path.join(__dirname, 'static', 'icons')));
app.use('/images', express.static(path.join(__dirname, 'static', 'images')));
app.use('/styles', express.static(path.join(__dirname, 'static', 'styles')));

// The page webpack builds from src/template.html, as the production build does.
app.use(
    pageFallback((req, res, next) => {
        req.url = '/index.html';
        devMiddleware(req, res, next).catch(next);
    })
);
app.use(notFound);

const server = app.listen(PORT, HOST, () => {
    console.info(`Listening at http://${HOST}:${PORT}`);
});

accounts?.sync.attach(server);

server.on('error', (err) => {
    console.error(err);
    process.exit(1);
});

const shutdown = () => {
    // The watching compiler would keep the process running.
    const closed = Promise.all([
        accounts?.sync.close(),
        new Promise((resolve) => devMiddleware.close(resolve))
    ]);

    hotMiddleware.close();
    server.close(() => {
        closed.then(() => accounts?.close()).finally(() => process.exit(0));
    });
    // Force-exit if connections do not drain in time.
    setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
