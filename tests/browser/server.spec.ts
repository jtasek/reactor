import { spawn, type ChildProcess } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { smoke } from '../../scripts/smoke.mjs';

const started: ChildProcess[] = [];

test.afterEach(() => {
    started.splice(0).forEach((server) => server.kill());
});

/**
 * Starts the production server with `env` on a port of its own, and reports its
 * output and how it exited.
 */
function startServer(env: Record<string, string>) {
    const server = spawn(process.execPath, ['server.prod.ts'], {
        env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', ...env }
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
    for (const [env, message] of [
        [{ PORT: 'abc' }, 'Invalid PORT: abc'],
        [{ PORT: '4174', TRUST_PROXY: 'yes' }, 'Invalid TRUST_PROXY: yes'],
        [
            { PORT: '4174', DATABASE_URL: 'postgres://localhost/reactor' },
            'BETTER_AUTH_URL is required'
        ]
    ] as const) {
        const { exited, output } = startServer(env);

        expect(await exited).toBe(1);
        expect(output()).toContain(message);
    }
});

test('shuts down cleanly when asked to stop', async ({ request }) => {
    const { server, exited } = startServer({ PORT: '4175' });

    await expect
        .poll(() =>
            request.get('http://127.0.0.1:4175/healthz').then(
                (response) => response.ok(),
                () => false
            )
        )
        .toBe(true);

    server.kill('SIGTERM');

    expect(await exited).toBe(0);
});
