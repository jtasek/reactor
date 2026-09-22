import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'retain-on-failure'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'pnpm run build:webpack && node server.prod.js',
        url: 'http://127.0.0.1:4173/healthz',
        env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '4173' },
        reuseExistingServer: false,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
        timeout: 120_000
    }
});
