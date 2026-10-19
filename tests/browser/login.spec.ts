import { expect, test, type Page } from '@playwright/test';

async function signedOut(page: Page, providers = ['google', 'github']) {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.route('**/api/sign-in/providers', (route) => route.fulfill({ json: providers }));
}

for (const provider of ['Google', 'GitHub']) {
    test(`login starts ${provider} OAuth and returns failures to the login page`, async ({
        page
    }) => {
        await signedOut(page);
        await page.route('**/api/auth/sign-in/social', async (route) => {
            expect(route.request().postDataJSON()).toEqual({
                provider: provider.toLowerCase(),
                callbackURL: '/documents',
                errorCallbackURL: '/login?oauth=failed',
                disableRedirect: true
            });
            await route.fulfill({ json: { url: 'https://identity.example.test/authorize' } });
        });
        await page.route('https://identity.example.test/authorize', (route) =>
            route.fulfill({ contentType: 'text/html', body: '<h1>Provider sign-in</h1>' })
        );
        await page.goto('/login');
        await page.getByRole('button', { name: `Continue with ${provider}` }).click();
        await expect(page).toHaveURL('https://identity.example.test/authorize');
    });
}

test('login is reachable from the editor and stays readable at narrow widths', async ({ page }) => {
    await signedOut(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-login-normal.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue without signing in' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
    );
    await page.screenshot({ path: '/tmp/reactor-login-narrow.png' });
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign in with a link', exact: true }).click();
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Continue without signing in' }).click();
    await expect(page).toHaveURL('/documents');
});

test('login keeps email available when OAuth fails and shows returned provider errors', async ({
    page
}) => {
    await signedOut(page);
    await page.route('**/api/auth/sign-in/social', (route) =>
        route.fulfill({ status: 503, json: {} })
    );
    await page.route('**/api/auth/sign-in/email', (route) =>
        route.fulfill({ status: 401, json: { code: 'INVALID_EMAIL_OR_PASSWORD' } })
    );
    await page.goto('/login?oauth=failed');
    await expect(page.getByRole('alert')).toContainText('Social sign-in was not completed');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page.getByRole('alert')).toContainText('Could not start sign-in');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
    await page.getByLabel('Password', { exact: true }).fill('incorrect password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('The email address or password is wrong.')).toBeVisible();
});

test('signed-in visitors to login are taken to their documents', async ({ page }) => {
    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({ json: { user: { id: 'ada', name: 'Ada', email: 'ada@example.com' } } })
    );
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }));
    await page.goto('/login');
    await expect(page).toHaveURL('/documents');
    await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible();
});

test('login on a server without accounts offers local documents without a dead form', async ({
    page
}) => {
    await page.goto('/login');
    await expect(page.getByText('This server has no accounts.', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Continue without signing in' }).click();
    await expect(page).toHaveURL('/documents');
});
