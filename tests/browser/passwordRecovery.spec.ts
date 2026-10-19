import { expect, test, type Page } from '@playwright/test';

async function signedOut(page: Page) {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.route('**/api/sign-in/providers', (route) =>
        route.fulfill({ json: ['google', 'github'] })
    );
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }));
}

test('recovery keeps the return destination and offers controlled email resend', async ({
    page
}) => {
    await signedOut(page);
    await page.clock.install();
    let requests = 0;
    await page.route('**/api/auth/request-password-reset', async (route) => {
        expect(route.request().postDataJSON()).toEqual({
            email: 'ada@example.com',
            redirectTo: '/reset-password?returnTo=%2Fsharing'
        });
        requests += 1;
        await route.fulfill({ json: { status: true } });
    });
    await page.goto('/login?returnTo=%2Fsharing');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('group', { name: 'Social sign-in' })).toHaveCount(0);
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeFocused();
    await expect(page.getByRole('status')).toContainText('If an account exists');
    await expect(page.getByRole('button', { name: /Resend email in/ })).toBeDisabled();
    await page.clock.runFor(30_000);
    await page.getByRole('button', { name: 'Resend email', exact: true }).click();
    await expect.poll(() => requests).toBe(2);
});

test('reset validates confirmation, handles failure, clears the token and returns to login', async ({
    page
}) => {
    await signedOut(page);
    let requests = 0;
    await page.route('**/api/auth/reset-password', async (route) => {
        expect(route.request().postDataJSON()).toEqual({
            token: 'reset-secret',
            newPassword: 'replacement password'
        });
        requests += 1;
        await route.fulfill(
            requests === 1
                ? { status: 400, json: { code: 'INVALID_TOKEN' } }
                : { json: { status: true } }
        );
    });
    await page.goto('/reset-password?returnTo=%2Fsharing#reset-secret');
    await expect(page.getByLabel('New password', { exact: true })).toBeFocused();
    await page.screenshot({ path: '/tmp/reactor-password-reset.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/reactor-password-reset-narrow.png' });
    await page.getByLabel('New password', { exact: true }).fill('replacement password');
    await page.getByLabel('Confirm new password').fill('different password');
    await page.getByRole('button', { name: 'Update password', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('The passwords do not match.');
    expect(requests).toBe(0);
    await page.getByLabel('Confirm new password').fill('replacement password');
    await page.getByRole('button', { name: 'Update password', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('invalid or has expired');
    await page.getByRole('button', { name: 'Update password', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Password updated' })).toBeFocused();
    await expect(page).toHaveURL('/reset-password?returnTo=%2Fsharing');
    await page.screenshot({ path: '/tmp/reactor-password-updated.png' });
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL('/login?returnTo=%2Fsharing');
});

test('missing tokens offer sign-in and reject external return destinations', async ({ page }) => {
    await signedOut(page);
    await page.goto('/reset-password?returnTo=https://evil.test');
    await expect(page.getByRole('alert')).toContainText('incomplete');
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL('/login?returnTo=%2Fdocuments');
});

test('invitation recovery never sends the invitation secret', async ({ page }) => {
    await signedOut(page);
    const token = 'a'.repeat(64);
    await page.route('**/api/auth/request-password-reset', async (route) => {
        expect(route.request().postDataJSON()).toEqual({
            email: 'ada@example.com',
            redirectTo: '/reset-password?returnTo=%2Finvite'
        });
        expect(route.request().postData()).not.toContain(token);
        await route.fulfill({ json: { status: true } });
    });
    await page.goto(`/invite#${token}`);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page).toHaveURL(`/invite#${token}`);
});

test('signed-in people can reset and cannot submit twice while the request is pending', async ({
    page
}) => {
    await signedOut(page);
    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({ json: { user: { id: 'ada', name: 'Ada', email: 'ada@example.com' } } })
    );
    let release = () => {};
    const waiting = new Promise<void>((resolve) => {
        release = resolve;
    });
    let requests = 0;
    await page.route('**/api/auth/reset-password', async (route) => {
        requests += 1;
        await waiting;
        await route.fulfill({ json: { status: true } });
    });
    await page.goto('/reset-password#reset-secret');
    await page.getByLabel('New password', { exact: true }).fill('replacement password');
    await page.getByLabel('Confirm new password').fill('replacement password');
    await page.getByRole('button', { name: 'Update password', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Updating password…' })).toBeDisabled();
    await expect(page.getByLabel('New password', { exact: true })).toBeDisabled();
    expect(requests).toBe(1);
    release();
    await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
});
