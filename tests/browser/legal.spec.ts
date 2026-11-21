import { expect, test } from '@playwright/test';

test('every way to sign up says it agrees to the Terms and Privacy policy, which open readable', async ({
    page
}) => {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.route('**/api/sign-in/providers', (route) => route.fulfill({ json: ['google'] }));
    await page.goto('/login');

    const agreement = page.getByText('By continuing, you agree to the Terms of use');

    for (const mode of ['Create an account', 'Sign in with a link', 'Sign in']) {
        await page.getByRole('button', { name: mode, exact: true }).click();
        await expect(agreement).toBeVisible();
    }

    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(agreement).toHaveCount(0);

    await page.goto('/login');
    const [terms] = await Promise.all([
        page.waitForEvent('popup'),
        page.getByRole('link', { name: 'Terms of use' }).click()
    ]);

    await expect(terms).toHaveURL('/terms');
    await expect(terms.getByRole('heading', { name: 'Terms of use', level: 1 })).toBeVisible();
    await terms.setViewportSize({ width: 390, height: 844 });
    expect(await terms.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
    );
    await terms.getByRole('link', { name: 'Privacy policy' }).click();
    await expect(terms).toHaveURL('/privacy');
    await expect(terms.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
    await expect(terms.getByRole('heading', { name: 'AI' })).toBeVisible();
});
