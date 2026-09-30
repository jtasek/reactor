import express from 'express';
import type { AddressInfo } from 'net';
import { notFound, pageFallback, parsePort } from '../../server/pages';

/** A server with one file, `/app.js`, and the page for every route, as both servers are. */
async function serve() {
    const app = express();

    app.get('/app.js', (_req, res) => {
        res.type('text/javascript').send('run()');
    });
    app.use(
        pageFallback((_req, res) => {
            res.type('text/html').send('<div id="app"></div>');
        })
    );
    app.use(notFound);

    const server = app.listen(0, '127.0.0.1');

    await new Promise((resolve) => server.once('listening', resolve));
    onTestFinished(() => {
        server.close();
    });

    const { port } = server.address() as AddressInfo;

    return (path: string, method = 'GET') => fetch(`http://127.0.0.1:${port}${path}`, { method });
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
