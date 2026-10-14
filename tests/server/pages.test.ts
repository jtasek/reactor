import express, { type RequestHandler } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'net';
import { notFound, pageFallback, parsePort, serveBuild } from '../../server/pages';

/**
 * A server answering with `handler`, by default with one file, `/app.js`, and the page for
 * every route, as both servers are.
 */
async function serve(
    handler: RequestHandler = express
        .Router()
        .get('/app.js', (_req, res) => {
            res.type('text/javascript').send('run()');
        })
        .use(
            pageFallback((_req, res) => {
                res.type('text/html').send('<div id="app"></div>');
            })
        )
) {
    const app = express();

    app.use(handler);
    app.use(notFound);

    const server = app.listen(0, '127.0.0.1');

    await new Promise((resolve) => server.once('listening', resolve));
    onTestFinished(() => {
        server.close();
    });

    const { port } = server.address() as AddressInfo;

    return (route: string, method = 'GET') => fetch(`http://127.0.0.1:${port}${route}`, { method });
}

/** A build output with its page and one hashed file, in a checkout under a dot-directory. */
function createBuild() {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'reactor-'));
    const directory = path.join(parent, '.checkout', 'dist');

    onTestFinished(() => fs.rmSync(parent, { recursive: true }));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'index.html'), '<div id="app"></div>');
    fs.writeFileSync(path.join(directory, 'main.0123abcd.js'), 'run()');

    return directory;
}

describe('pages', () => {
    it('serves the page for the editor’s routes, and files as they are', async () => {
        const request = await serve();

        for (const route of ['/', '/documents', '/account']) {
            const response = await request(route);

            expect(response.status).toBe(200);
            expect(await response.text()).toBe('<div id="app"></div>');
        }

        expect((await request('/documents', 'HEAD')).status).toBe(200);
        expect(await (await request('/app.js')).text()).toBe('run()');
    });

    it('serves the build from a checkout under a dot-directory, its page never cached', async () => {
        const request = await serve(serveBuild(createBuild()));
        const page = await request('/documents');

        expect(await page.text()).toBe('<div id="app"></div>');
        expect(page.status).toBe(200);
        expect(page.headers.get('content-type')).toContain('text/html');
        expect(page.headers.get('cache-control')).toBe('no-cache');

        const file = await request('/main.0123abcd.js');

        expect(await file.text()).toBe('run()');
        expect(file.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
        expect((await request('/missing.js')).status).toBe(404);
    });

    it('answers the editor’s routes as missing while the build has no page', async () => {
        const directory = createBuild();
        const request = await serve(serveBuild(directory));

        fs.rmSync(path.join(directory, 'index.html'));

        const response = await request('/documents');

        expect(response.status).toBe(404);
        expect(await response.text()).toBe('Not Found');
    });

    it('answers a missing file as missing rather than with the page', async () => {
        const request = await serve();
        const response = await request('/missing.js');

        expect(response.status).toBe(404);
        expect(await response.text()).toBe('Not Found');
    });

    it('refuses other methods than GET and HEAD', async () => {
        const request = await serve();
        const response = await request('/documents', 'POST');

        expect(response.status).toBe(405);
        expect(response.headers.get('allow')).toBe('GET, HEAD');
    });

    it('reads the port, 4000 when unset, and refuses one no server can listen on', () => {
        expect(parsePort(undefined)).toBe(4000);
        expect(parsePort('8080')).toBe(8080);

        for (const port of ['', '0', '65536', '80.5', 'http']) {
            expect(() => parsePort(port)).toThrow(`Invalid PORT: ${port}`);
        }
    });
});
