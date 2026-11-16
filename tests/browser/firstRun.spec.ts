import { expect, test, type Page } from '@playwright/test';

test.use({
    storageState: {
        cookies: [],
        origins: [
            {
                origin: 'http://127.0.0.1:4173',
                localStorage: [{ name: 'reactor:notices', value: '["first","many"]' }]
            }
        ]
    }
});

const guide = (page: Page) =>
    page.getByRole('complementary', { name: 'Share your first prototype' });
const step = (page: Page, name: string) =>
    guide(page).getByRole('listitem').filter({ hasText: name });

test('starts from a template, edits it, plays it and is asked to sign in to share', async ({
    page
}) => {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Start a prototype' })).toBeVisible();
    // Component variants are not a first prototype's concern.
    await expect(page.getByRole('button', { name: /^Start from / })).toHaveCount(4);
    await page.getByRole('button', { name: 'Start from Forms' }).click();

    await expect(page.getByRole('heading', { name: 'Start a prototype' })).toBeHidden();
    await expect(guide(page)).toBeVisible();
    await expect(page.getByText('Forms starter', { exact: true })).toBeVisible();
    await expect(step(page, 'Make it yours')).not.toContainText('(done)');

    await page.locator('svg#surface text:visible', { hasText: 'No requests yet' }).first().click();
    const text = page.getByRole('textbox', { name: 'Text', exact: true });
    await text.fill('No bookings yet');
    await text.press('Enter');
    await expect(step(page, 'Make it yours')).toContainText('(done)');

    await guide(page).getByRole('button', { name: 'Play prototype' }).click();
    await expect(page).toHaveURL(/\/prototype$/);
    await expect(step(page, 'Play it')).toContainText('(done)');
    await expect(step(page, 'Share a link')).toContainText('Choose Share at the top right');

    await page.getByRole('button', { name: 'Share prototype' }).click();
    await page.getByRole('button', { name: 'Sign in to share' }).click();
    await expect(page).toHaveURL(/\/login\?returnTo=%2F$|\/login\?returnTo=\/$/);
    const documentId = await page.evaluate(
        () => JSON.parse(localStorage.getItem('reactor:open-after-sign-in') ?? '{}').documentId
    );
    expect(documentId).toBe(
        await page.evaluate(
            () => JSON.parse(localStorage.getItem('reactor:first-run') ?? '{}').documentId
        )
    );
});

test('keeps the guide closed once closed', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start from List / detail' }).click();
    await guide(page).getByRole('button', { name: 'Close guide' }).click();
    await expect(guide(page)).toBeHidden();

    await page.reload();
    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(page.getByText('List / detail starter', { exact: true })).toBeVisible();
    await expect(guide(page)).toBeHidden();
});

test('a blank start is not offered templates again', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start with a blank canvas' }).click();
    await expect(page.getByRole('heading', { name: 'Start a prototype' })).toBeHidden();

    await page.reload();
    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Start a prototype' })).toBeHidden();
});

test('a drawing tool starts blank', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Start a prototype' })).toBeVisible();
    await page
        .getByRole('list', { name: 'Tools' })
        .getByRole('button', { name: 'Draws a rectangle or square', exact: true })
        .dispatchEvent('click');
    await expect(page.getByRole('heading', { name: 'Start a prototype' })).toBeHidden();
    expect(
        await page.evaluate(() => localStorage.getItem('reactor:first-run:started'))
    ).not.toBeNull();
});
