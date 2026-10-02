import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const LOCAL_ONLY = 'Your documents are kept only in this browser';

test('tells a signed-out user once that documents are kept only in this browser', async ({
    page
}) => {
    await page.goto('/');

    const notice = page.getByRole('status').filter({ hasText: LOCAL_ONLY });

    await expect(notice).toBeVisible();
    // An information notice: tinted in its color, with text in a darker shade of it.
    await expect(notice).toHaveAttribute('data-type', 'info');
    await expect(notice).toHaveCSS('background-color', 'rgb(228, 223, 243)');
    await expect(notice).toHaveCSS('color', 'rgb(106, 85, 194)');
    // This server has no accounts, so there is no sign-in to offer.
    await expect(notice.getByRole('link')).toHaveCount(0);

    await notice.getByRole('button', { name: 'Dismiss' }).click();
    await expect(notice).toHaveCount(0);

    await page.reload();
    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: LOCAL_ONLY })).toHaveCount(0);
});

test('the account page says when the server has no accounts', async ({ page }) => {
    await page.goto('/account');

    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
    await expect(page.getByText('This server has no accounts.')).toBeVisible();

    await page.getByRole('link', { name: 'Back to the editor' }).click();
    await expect(page.locator('svg#surface')).toBeVisible();
});

test('an open tab loads again when another tab signs someone in or out', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('svg#surface')).toBeVisible();

    const other = await page.context().newPage();

    await other.goto('/');
    await expect(other.locator('svg#surface')).toBeVisible();

    // As the other tab does once it has loaded again after signing in.
    const reloaded = page.waitForEvent('load');

    await other.evaluate(() => localStorage.setItem('reactor:account', 'user-ada'));
    await reloaded;
});
