import { expect, test } from '@playwright/test';
import { LEGAL_VERSION } from '../../src/shared/legal';

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

test('an account that has not agreed to the current terms is asked once, and agreeing closes it', async ({
    page
}) => {
    const user = { id: 'legal-ada', name: 'Ada', email: 'ada@example.com' };
    let agreed: string | null = null;
    let sent: unknown;

    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: { user } }));
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/legal', async (route) => {
        if (route.request().method() === 'POST') {
            sent = route.request().postDataJSON();
            agreed = LEGAL_VERSION;
            await route.fulfill({ status: 204 });

            return;
        }

        await route.fulfill({ json: { version: LEGAL_VERSION, agreed } });
    });

    await page.goto('/documents');

    const dialog = page.getByRole('dialog', { name: 'Terms of use and Privacy policy' });

    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(
        'To keep using Reactor, read and agree to them.'
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Agree' }).click();
    await expect(dialog).toHaveCount(0);
    expect(sent).toEqual({ version: LEGAL_VERSION });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Documents' }).first()).toBeVisible();
    await expect(dialog).toHaveCount(0);
});
