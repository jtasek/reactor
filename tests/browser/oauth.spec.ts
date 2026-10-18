import { expect, test } from '@playwright/test';

for (const provider of ['Google', 'GitHub']) {
    test(`${provider} sign-in redirects without requiring email fields`, async ({ page }) => {
        await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
        await page.route('**/api/sign-in/providers', (route) =>
            route.fulfill({ json: [provider.toLowerCase()] })
        );
        await page.route('**/api/auth/sign-in/social', async (route) => {
            expect(route.request().postDataJSON()).toEqual({
                provider: provider.toLowerCase(),
                callbackURL: '/account',
                errorCallbackURL: '/account?oauth=failed',
                disableRedirect: true
            });
            await route.fulfill({
                json: { url: 'https://identity.example.test/authorize', redirect: false }
            });
        });
        await page.route('https://identity.example.test/authorize', (route) =>
            route.fulfill({ contentType: 'text/html', body: '<h1>Provider sign-in</h1>' })
        );
        await page.goto('/account');
        await expect(
            page.getByRole('group', { name: 'Social sign-in' }).getByRole('button')
        ).toHaveCount(1);
        await page.getByRole('button', { name: `Continue with ${provider}` }).click();
        await expect(page).toHaveURL('https://identity.example.test/authorize');
    });
}

test('a failed OAuth request can be retried and email sign-in remains available', async ({
    page
}) => {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.route('**/api/sign-in/providers', (route) =>
        route.fulfill({ json: ['google', 'github'] })
    );
    await page.route('**/api/auth/sign-in/social', (route) =>
        route.fulfill({ status: 503, json: {} })
    );
    await page.goto('/account?oauth=failed');
    await expect(page.getByRole('alert')).toContainText('Social sign-in was not completed');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page.getByRole('alert')).toContainText('Could not start sign-in');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
});

test('unconfigured providers do not appear', async ({ page }) => {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.route('**/api/sign-in/providers', (route) => route.fulfill({ json: [] }));
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Social sign-in' })).toHaveCount(0);
});
