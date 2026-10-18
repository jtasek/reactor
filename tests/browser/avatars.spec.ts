import { expect, test, type Page } from '@playwright/test';

const PHOTO = 'https://profiles.example.test/ada.svg';

async function signIn(page: Page, image: string | null) {
    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({
            json: { user: { id: 'ada', name: 'Ada', email: 'ada@example.com', image } }
        })
    );
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/ai', (route) => route.fulfill({ json: { available: false } }));
}

test('account photos load over HTTPS without a referrer or duplicate accessible name', async ({
    page
}) => {
    await signIn(page, PHOTO);
    const referrers: (string | undefined)[] = [];
    await page.route(PHOTO, (route) => {
        referrers.push(route.request().headers().referer);
        return route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="32"><rect width="48" height="32" fill="#3366ff"/></svg>'
        });
    });
    await page.goto('/account');
    const photo = page.locator('main img');
    await expect(photo).toBeVisible();
    await expect
        .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBe(48);
    await expect(photo).toHaveCSS('object-fit', 'cover');
    await expect(photo.locator('..')).toHaveCSS('border-radius', '50%');
    await expect(photo.locator('../..')).toHaveAttribute('aria-hidden', 'true');
    await page.goto('/documents');
    const account = page.getByRole('link', { name: 'Ada', exact: true });
    await expect(account.locator('img')).toBeVisible();
    expect(referrers.length).toBeGreaterThan(0);
    expect(referrers.every((referrer) => referrer === undefined)).toBe(true);
});

for (const image of [null, PHOTO]) {
    test(`a ${image ? 'broken' : 'missing'} account photo keeps the user icon`, async ({
        page
    }) => {
        await signIn(page, image);
        await page.route(PHOTO, (route) => route.fulfill({ status: 404, body: '' }));
        await page.goto('/account');
        await expect(page.getByText('Signed in as Ada (ada@example.com).')).toBeVisible();
        await expect(page.locator('main img')).toHaveCount(0);
        await expect(page.locator('main svg.lucide-user-round')).toBeVisible();
    });
}
