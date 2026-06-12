import path, { dirname } from 'path';
import express from 'express';
import webpack from 'webpack';
import webpackMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import { config } from './webpack.config.mjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { PORT = 4000, HOST = 'localhost' } = process.env;
const indexHtml = path.join(__dirname, 'src', 'index.html');

const app = express();
const compiler = webpack(config);

app.use(
    webpackMiddleware(compiler, {
        publicPath: config.output.publicPath,
        stats: { colors: true }
    })
);

app.use(
    webpackHotMiddleware(compiler, {
        reload: true // reload page when webpack gets stuck
    })
);

app.use('/icons', express.static(path.join(__dirname, 'static', 'icons')));
app.use('/images', express.static(path.join(__dirname, 'static', 'images')));
app.use('/styles', express.static(path.join(__dirname, 'static', 'styles')));

// SPA fallback: serve index.html for client-side routes (e.g. /documents)
app.use((req, res, next) => {
    if (req.method !== 'GET') {
        return next();
    }
    res.sendFile(indexHtml);
});

const server = app.listen(Number(PORT), HOST, () => {
    console.log(`Listening at http://${HOST}:${PORT}`);
});

server.on('error', (err) => {
    console.error(err);
    process.exit(1);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
