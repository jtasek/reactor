import { spawn, type ChildProcess } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { smoke } from '../../scripts/smoke.mjs';

const started: ChildProcess[] = [];

/** The server's settings the shell running the tests may hold, cleared unless a test sets them. */
const CLEARED = {
    DATABASE_URL: '',
    BETTER_AUTH_URL: '',
    BETTER_AUTH_SECRET: '',
    SMTP_URL: '',
    TRUST_PROXY: ''
};

/**
 * How long a spawned server may take to answer, which a busy machine stretches past the
 * 5 s default.
 */
const SERVER_START_MS = 15_000;

/** How long one health check may take, so a stalled one does not hide that the server exited. */
const HEALTH_CHECK_MS = 1_000;

test.afterEach(() => {
    started.splice(0).forEach((server) => server.kill());
});

/**
 * Starts the production server with `env` on a port of its own, and reports its
 * output and how it exited.
 */
function startServer(env: Record<string, string>) {
    const server = spawn(process.execPath, ['server.prod.ts'], {
        env: { ...process.env, ...CLEARED, NODE_ENV: 'production', HOST: '127.0.0.1', ...env }
    });
    let output = '';

    server.stdout.on('data', (data: Buffer) => (output += data));
    server.stderr.on('data', (data: Buffer) => (output += data));

    const exited = new Promise<number | null>((resolve) => server.on('exit', resolve));

    started.push(server);

    return { server, exited, output: () => output };
}

test('answers as a deployed server should', async ({ baseURL }) => {
    expect(await smoke(baseURL)).toEqual([]);
});

test('renders every page within its content security policy', async ({ page }) => {
    const violations: string[] = [];

    page.on('console', (message) => {
        if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
            violations.push(message.text());
        }
    });

    for (const route of ['/', '/documents', '/account']) {
        await page.goto(route);
        await expect(page.locator('#app > *').first()).toBeVisible();
    }

    await page.goto('/');
    await expect(page.locator('svg#surface')).toBeVisible();
    expect(violations).toEqual([]);
});

test('stops at once with a clear message when misconfigured', async () => {
    const misconfigurations = [
        [{ PORT: 'abc' }, 'Invalid PORT: abc'],
        [{ PORT: '4174', TRUST_PROXY: 'yes' }, 'Invalid TRUST_PROXY: yes'],
        [
            { PORT: '4174', DATABASE_URL: 'postgres://localhost/reactor' },
            'BETTER_AUTH_URL is required'
        ]
    ] as const;

    test.setTimeout(misconfigurations.length * SERVER_START_MS);

    for (const [env, message] of misconfigurations) {
        const { exited, output } = startServer(env);

        expect(await exited).toBe(1);
        expect(output()).toContain(message);
    }
});

test('shuts down cleanly when asked to stop', async ({ request }) => {
    const { server, exited, output } = startServer({ PORT: '4175' });
    const health = () =>
        server.exitCode === null
            ? request.get('http://127.0.0.1:4175/healthz', { timeout: HEALTH_CHECK_MS }).then(
                  (response) => (response.ok() ? 'answering' : 'starting'),
                  () => 'starting'
              )
            : `exited with ${server.exitCode}:\n${output()}`;

    await expect.poll(health, { timeout: SERVER_START_MS }).not.toBe('starting');
    expect(await health()).toBe('answering');

    server.kill('SIGTERM');

    expect(await exited).toBe(0);
});
