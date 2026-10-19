import { expect, test, type Page } from '@playwright/test';

const user = { id: 'auth-ada', name: 'Ada', email: 'ada@example.com' };

async function signedOut(page: Page) {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.route('**/api/sign-in/providers', (route) =>
        route.fulfill({ json: ['google', 'github'] })
    );
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }));
}

test('legacy routes use login and retain the intended destination and provider error', async ({
    page
}) => {
    await signedOut(page);
    await page.goto('/signin/?returnTo=%2Fsharing');
    await expect(page).toHaveURL('/login?returnTo=%2Fsharing');
    await page.goto('/account?oauth=failed');
    await expect(page).toHaveURL('/login?oauth=failed&returnTo=%2Faccount');
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Social sign-in was not completed');
});

test('password login coordinates all controls and opens Documents by default', async ({ page }) => {
    await signedOut(page);
    let loggedIn = false;
    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({ json: loggedIn ? { user } : null })
    );
    let release = () => {};
    const waiting = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/api/auth/sign-in/email', async (route) => {
        await waiting;
        loggedIn = true;
        await route.fulfill({ json: { user } });
    });
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('correct password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Signing in…', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Create an account', exact: true })
    ).toBeDisabled();
    await expect(page.getByLabel('Email', { exact: true })).toBeDisabled();
    release();
    await expect(page).toHaveURL('/documents');
});

test('provider requests disable email and mode switching and release them after failure', async ({
    page
}) => {
    await signedOut(page);
    let release = () => {};
    const waiting = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/api/auth/sign-in/social', async (route) => {
        await waiting;
        await route.fulfill({ status: 503, json: {} });
    });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page.getByRole('button', { name: 'Continuing with Google…' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Sign in with a link', exact: true })
    ).toBeDisabled();
    release();
    await expect(page.getByRole('alert')).toHaveText('Could not start sign-in. Please try again.');
    await expect(page.getByLabel('Email', { exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeEnabled();
});

test('email links show a focused check-email step with controlled resend and editable address', async ({
    page
}) => {
    await signedOut(page);
    await page.clock.install();
    let requests = 0;
    await page.route('**/api/auth/sign-in/magic-link', async (route) => {
        expect(route.request().postDataJSON()).toEqual({
            email: user.email,
            callbackURL: '/documents'
        });
        requests += 1;
        await route.fulfill({ json: { status: true } });
    });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in with a link', exact: true }).click();
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByRole('button', { name: 'Email me a link', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeFocused();
    await expect(page.getByRole('status')).toContainText(user.email);
    await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Social sign-in' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Resend email in/ })).toBeDisabled();
    await page.clock.runFor(30_000);
    await page.getByRole('button', { name: 'Resend email', exact: true }).click();
    await expect.poll(() => requests).toBe(2);
    await page.screenshot({ path: '/tmp/reactor-check-email.png' });
    await page.getByRole('button', { name: 'Use another email' }).click();
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(user.email);
});

test('signup resends verification rather than creating another account', async ({ page }) => {
    await signedOut(page);
    await page.clock.install();
    let signups = 0;
    let resends = 0;
    await page.route('**/api/auth/sign-up/email', async (route) => {
        expect(route.request().postDataJSON()).toEqual({
            name: user.name,
            email: user.email,
            password: 'correct password',
            callbackURL: '/documents'
        });
        signups += 1;
        await route.fulfill({ json: { user } });
    });
    await page.route('**/api/auth/send-verification-email', async (route) => {
        expect(route.request().postDataJSON()).toEqual({
            email: user.email,
            callbackURL: '/documents'
        });
        resends += 1;
        await route.fulfill({ json: { status: true } });
    });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(user.name);
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('correct password');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('confirm your address and sign in');
    await page.clock.runFor(30_000);
    await page.getByRole('button', { name: 'Resend email', exact: true }).click();
    await expect.poll(() => resends).toBe(1);
    expect(signups).toBe(1);
});

test('Sharing keeps its return destination when opening login', async ({ page }) => {
    await signedOut(page);
    await page.route('**/api/auth/sign-in/social', async (route) => {
        expect(route.request().postDataJSON()).toMatchObject({
            callbackURL: '/sharing',
            errorCallbackURL: '/login?oauth=failed&returnTo=%2Fsharing'
        });
        await route.fulfill({ status: 503, json: {} });
    });
    await page.goto('/sharing');
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/login\?returnTo=.*sharing/);
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
});
