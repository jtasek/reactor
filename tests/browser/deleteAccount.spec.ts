import { expect, test } from '@playwright/test';

const user = { id: 'delete-ada', name: 'Ada', email: 'ada@example.com' };

test('deleting the account asks for the email and password, clears this browser and returns to login', async ({
    page
}) => {
    let signedIn = true;
    let sent: unknown;
    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({ json: signedIn ? { user } : null })
    );
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/sign-in/providers', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/auth/list-accounts', (route) =>
        route.fulfill({ json: [{ providerId: 'credential' }] })
    );
    await page.route('**/api/auth/delete-user', async (route) => {
        sent = route.request().postDataJSON();

        if ((sent as { password?: string }).password !== 'right password') {
            await route.fulfill({ status: 400, json: { code: 'INVALID_PASSWORD' } });

            return;
        }

        signedIn = false;
        await route.fulfill({ json: { success: true, message: 'User deleted' } });
    });

    await page.goto('/account');
    await page.getByRole('button', { name: 'Delete account…' }).click();

    const confirm = page.getByLabel('Type ada@example.com to confirm');
    const remove = page.getByRole('button', { name: 'Delete account permanently' });

    await expect(confirm).toBeFocused();
    await expect(remove).toBeDisabled();
    await confirm.fill('ada@example.com');
    await page.getByLabel('Password').fill('wrong password');
    await remove.click();
    await expect(page.getByRole('alert')).toHaveText('The password is wrong.');
    expect(signedIn).toBe(true);

    await page.getByLabel('Password').fill('right password');
    await remove.click();
    await expect(page).toHaveURL('/login?accountDeleted');
    await expect(page.getByRole('status')).toHaveText('Your account was deleted.');
    expect(sent).toEqual({ password: 'right password' });

    const saved = await page.evaluate(async () => ({
        owner: localStorage.getItem('reactor:account'),
        databases: (await indexedDB.databases()).map(({ name }) => name)
    }));

    expect(saved.owner).toBe('');
    expect(saved.databases).not.toContain('reactor-delete-ada');
});
