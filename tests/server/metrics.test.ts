import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { createMetrics } from '../../server/metrics';
import { answer, replay } from '../ai/replay';
import { ORIGIN, serve, type DocumentSummary, type ServeOptions } from './support';

const PREVIEW = 'https://app.prototype.test';
const TOKEN = 'a metrics token for the tests';
const PLAYER_A = 'player-a-0123456789abcdef';
const PLAYER_B = 'player-b-0123456789abcdef';

const screen = (id: string) => ({ id, name: id, x: 0, y: 0, width: 390, height: 844, nodes: [] });

async function setup(options: ServeOptions = {}) {
    const server = await serve({ previewOrigin: PREVIEW, metricsToken: TOKEN, ...options });
    const admin = await server.user('admin@example.com');
    const document = await server.json<DocumentSummary>(
        server.call('POST', `/workspaces/${admin.personal.id}/documents`, {
            cookie: admin.cookie,
            body: { name: 'App' }
        })
    );
    const share = async (screens: string[]) => {
        const response = await server.call('POST', `/documents/${document.id}/prototype-links`, {
            cookie: admin.cookie,
            body: {
                name: 'Shared',
                application: { documentId: document.id, images: {}, screens: screens.map(screen) }
            }
        });
        const link = (await response.json()) as { id: string; url: string };

        return { ...link, token: new URL(link.url).hash.slice(1) };
    };
    const open = (token: string, player?: string) =>
        server.call('POST', '/prototype-links/open', {
            body: { token, player },
            headers: { origin: PREVIEW }
        });
    const read = (path: string, token = TOKEN) =>
        fetch(`${server.address}${path}`, { headers: { authorization: `Bearer ${token}` } });
    const metrics = async () => (await read('/metrics')).text();
    const prototypes = async () =>
        (await (await read('/metrics/prototypes')).json()) as {
            linkId: string;
            screens: number;
            players: number;
            opens: number;
        }[];

    return { ...server, admin, document, share, open, read, metrics, prototypes };
}

/** The value of one series in Prometheus text, or undefined when it has none. */
const value = (text: string, series: string) => {
    const line = text.split('\n').find((candidate) => candidate.startsWith(`${series} `));

    return line === undefined ? undefined : Number(line.slice(series.length + 1));
};

describe('measures of shared prototypes', () => {
    it('counts links created, screens in each and distinct players per link', async () => {
        const server = await setup();
        const first = await server.share(['home', 'details', 'settings']);
        const second = await server.share(['home']);

        expect((await server.open(first.token, PLAYER_A)).status).toBe(200);
        expect((await server.open(first.token, PLAYER_A)).status).toBe(200);
        expect((await server.open(first.token, PLAYER_B)).status).toBe(200);
        // A browser that keeps nothing is shown the prototype but is no player.
        expect((await server.open(first.token)).status).toBe(200);
        expect((await server.open(first.token, 'short')).status).toBe(200);

        expect(await server.prototypes()).toEqual([
            expect.objectContaining({ linkId: second.id, screens: 1, players: 0, opens: 0 }),
            expect.objectContaining({ linkId: first.id, screens: 3, players: 2, opens: 3 })
        ]);

        const players = await server.db.selectFrom('prototype_players').selectAll().execute();
        expect(players.map(({ player }) => player)).not.toContain(PLAYER_A);
        expect(players.map(({ player }) => player)).not.toContain(PLAYER_B);

        const text = await server.metrics();
        expect(value(text, 'reactor_prototype_publishes_total{result="created"}')).toBe(2);
        expect(value(text, 'reactor_prototype_opens_total{result="shown"}')).toBe(5);
    });

    it('counts one browser once per link, but as a player of each link it opens', async () => {
        const server = await setup();
        const first = await server.share(['home']);
        const second = await server.share(['home']);

        await server.open(first.token, PLAYER_A);
        await server.open(second.token, PLAYER_A);

        const players = await server.db.selectFrom('prototype_players').selectAll().execute();
        expect(players).toHaveLength(2);
        expect(players[0].player).not.toBe(players[1].player);
    });

    it('keeps a link counted once it is revoked', async () => {
        const server = await setup();
        const link = await server.share(['home', 'details']);
        await server.open(link.token, PLAYER_A);

        await server.call('DELETE', `/documents/${server.document.id}/prototype-links/${link.id}`, {
            cookie: server.admin.cookie
        });

        expect((await server.open(link.token, PLAYER_B)).status).toBe(404);
        expect(await server.prototypes()).toEqual([
            expect.objectContaining({ linkId: link.id, screens: 2, players: 1 })
        ]);
        expect(
            value(await server.metrics(), 'reactor_prototype_opens_total{result="missing"}')
        ).toBe(1);
    });

    it('counts refused snapshots apart from published ones', async () => {
        const server = await setup();
        const response = await server.call(
            'POST',
            `/documents/${server.document.id}/prototype-links`,
            {
                cookie: server.admin.cookie,
                body: {
                    name: 'Empty',
                    application: { documentId: server.document.id, screens: [] }
                }
            }
        );

        expect(response.status).toBe(400);
        expect(
            value(await server.metrics(), 'reactor_prototype_publishes_total{result="invalid"}')
        ).toBe(1);
        expect(await server.prototypes()).toEqual([]);
    });
});

describe('server metrics', () => {
    it('are read only with the bearer token, and not at all without one configured', async () => {
        const server = await setup();

        expect((await server.read('/metrics', 'wrong')).status).toBe(401);
        expect((await fetch(`${server.address}/metrics`)).status).toBe(401);
        expect((await server.read('/metrics/prototypes', 'wrong')).status).toBe(401);
        const ok = await server.read('/metrics');
        expect(ok.status).toBe(200);
        expect(ok.headers.get('content-type')).toContain('text/plain');
        expect(ok.headers.get('cache-control')).toBe('no-store');

        const without = await serve();
        expect((await fetch(`${without.address}/metrics`)).status).toBe(404);
    });

    it('count sync connections and document saves', async () => {
        const server = await setup();
        const ydoc = new Y.Doc();

        class BrowserSocket extends WebSocket {
            constructor(address: string, protocols?: string | string[]) {
                super(address, protocols, {
                    headers: { cookie: server.admin.cookie, origin: ORIGIN }
                });
            }
        }
        const socket = new HocuspocusProviderWebsocket({
            url: server.syncURL,
            WebSocketPolyfill: BrowserSocket
        });
        const provider = new HocuspocusProvider({
            websocketProvider: socket,
            name: server.document.id,
            document: ydoc
        });
        provider.attach();
        onTestFinished(() => {
            provider.destroy();
            socket.destroy();
        });
        await vi.waitFor(async () =>
            expect(value(await server.metrics(), 'reactor_sync_connections')).toBe(1)
        );
        ydoc.getText('notes').insert(0, 'Ship it');

        provider.destroy();
        socket.destroy();
        await vi.waitFor(async () => {
            const text = await server.metrics();
            expect(value(text, 'reactor_sync_connections')).toBe(0);
            expect(value(text, 'reactor_document_saves_total{result="ok"}')).toBeGreaterThan(0);
        });
        const text = await server.metrics();
        expect(value(text, 'reactor_sync_connections_opened_total')).toBe(1);

        const refused = await new Promise<number>((resolve) => {
            const stranger = new WebSocket(server.syncURL, { headers: { origin: ORIGIN } });
            stranger.on('unexpected-response', (_request, response) =>
                resolve(response.statusCode ?? 0)
            );
        });
        expect(refused).toBe(401);
        expect(value(await server.metrics(), 'reactor_sync_refused_total{reason="session"}')).toBe(
            1
        );
    });

    it('time AI turns and their first operation, and count refusals', async () => {
        const replayed = replay([
            answer({
                calls: [
                    {
                        name: 'addShape',
                        input: {
                            key: 'box',
                            shape: {
                                type: 'rectangle',
                                position: { x: 0, y: 0 },
                                size: { width: 20, height: 10 }
                            }
                        }
                    }
                ]
            })
        ]);
        const server = await setup({ ai: { provider: replayed.provider } });
        const ask = () =>
            server.call('POST', `/ai/documents/${server.document.id}/requests`, {
                cookie: server.admin.cookie,
                body: { task: 'edit', prompt: 'Add a box', context: { shapes: {} } }
            });

        await (await ask()).text();
        await server.db.updateTable('workspaces').set({ ai_enabled: false }).execute();
        expect((await ask()).status).toBe(403);

        const text = await server.metrics();
        expect(
            value(text, 'reactor_ai_turns_total{task="edit",turn="request",result="done"}')
        ).toBe(1);
        expect(
            value(text, 'reactor_ai_first_operation_seconds_count{task="edit",turn="request"}')
        ).toBe(1);
        expect(value(text, 'reactor_ai_turn_seconds_count{task="edit",turn="request"}')).toBe(1);
        expect(
            value(text, 'reactor_ai_turn_seconds_bucket{task="edit",turn="request",le="+Inf"}')
        ).toBe(1);
        expect(value(text, 'reactor_ai_refusals_total{code="AI_OFF"}')).toBe(1);
    });
});

describe('browser error reports', () => {
    const report = (address: string, body: object, origin = address) =>
        fetch(`${address}/api/client-errors`, {
            method: 'POST',
            headers: { origin, 'content-type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify(body)
        });

    it('are logged and counted, without the page’s query or fragment', async () => {
        const warn = vi.fn();
        const server = await setup({ log: { warn } });

        const response = await report(server.address, {
            kind: 'error',
            message: 'TypeError: boom',
            stack: 'at draw (main.js:1:2)',
            page: 'https://reactor.test/designer?document=secret#token',
            release: '31'
        });

        expect(response.status).toBe(204);
        expect(warn).toHaveBeenCalledWith(
            {
                browserError: {
                    kind: 'error',
                    message: 'TypeError: boom',
                    stack: 'at draw (main.js:1:2)',
                    page: '/designer',
                    release: '31'
                }
            },
            'Browser error'
        );
        expect(value(await server.metrics(), 'reactor_browser_errors_total{kind="error"}')).toBe(1);
    });

    it('are taken only from the editor’s own pages, and only so many at a time', async () => {
        const warn = vi.fn();
        const server = await setup({
            log: { warn },
            browserErrorLimits: { perAddress: 2, total: 100, windowMs: 60_000 }
        });

        expect(
            (await report(server.address, { message: 'x' }, 'https://attacker.example')).status
        ).toBe(403);
        expect((await report(server.address, { message: 'x' }, 'null')).status).toBe(403);
        expect((await report(server.address, { message: 'a' })).status).toBe(204);
        expect((await report(server.address, { kind: 'rejection', message: 'b' })).status).toBe(
            204
        );
        expect((await report(server.address, { message: 'c' })).status).toBe(429);
        expect(warn).toHaveBeenCalledTimes(2);

        const text = await server.metrics();
        expect(value(text, 'reactor_browser_errors_total{kind="rejection"}')).toBe(1);
        expect(value(text, 'reactor_browser_errors_dropped_total')).toBe(1);
    });
});

describe('the metrics text', () => {
    it('escapes label values and renders histograms cumulatively', () => {
        const metrics = createMetrics();
        metrics.count('things_total', 'Things.', { name: 'a "quoted"\nname' });
        metrics.observe('wait_seconds', 'Waits.', 0.3, {}, [0.25, 1]);
        metrics.observe('wait_seconds', 'Waits.', 0.1, {}, [0.25, 1]);

        expect(metrics.render()).toBe(
            [
                '# HELP things_total Things.',
                '# TYPE things_total counter',
                'things_total{name="a \\"quoted\\"\\nname"} 1',
                '# HELP wait_seconds Waits.',
                '# TYPE wait_seconds histogram',
                'wait_seconds_bucket{le="0.25"} 1',
                'wait_seconds_bucket{le="1"} 2',
                'wait_seconds_bucket{le="+Inf"} 2',
                'wait_seconds_sum 0.4',
                'wait_seconds_count 2',
                ''
            ].join('\n')
        );
    });
});
