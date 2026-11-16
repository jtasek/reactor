import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        // The signed-out notices count as shown and the first document as started, so
        // neither covers what tests click; tests/browser/notices.spec.ts and
        // tests/browser/firstRun.spec.ts start without these.
        storageState: {
            cookies: [],
            origins: [
                {
                    origin: 'http://127.0.0.1:4173',
                    localStorage: [
                        { name: 'reactor:notices', value: '["first","many"]' },
                        { name: 'reactor:first-run:started', value: 'true' }
                    ]
                }
            ]
        },
        trace: 'retain-on-failure'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
        {
            command: 'pnpm run build:webpack && node server.prod.ts',
            url: 'http://127.0.0.1:4173/healthz',
            // Without accounts, whatever the shell running the tests holds.
            env: {
                NODE_ENV: 'production',
                HOST: '127.0.0.1',
                PORT: '4173',
                DATABASE_URL: '',
                TRUST_PROXY: '',
                PREVIEW_ORIGIN: 'http://127.0.0.1:4194',
                EDITOR_ORIGIN: 'http://127.0.0.1:4173',
                PREVIEW_ALLOW_LOCALHOST: 'true'
            },
            reuseExistingServer: false,
            gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
            timeout: 120_000
        },
        {
            command: 'node server.preview.ts',
            url: 'http://127.0.0.1:4194/healthz',
            env: {
                NODE_ENV: 'production',
                HOST: '127.0.0.1',
                PORT: '4194',
                PREVIEW_ORIGIN: 'http://127.0.0.1:4194',
                EDITOR_ORIGIN: 'http://127.0.0.1:4173',
                PREVIEW_ALLOW_LOCALHOST: 'true'
            },
            reuseExistingServer: false,
            gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
            timeout: 120_000
        }
    ]
});
