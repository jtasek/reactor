import { expect, test } from '@playwright/test';

test('a signed-in person sends feedback from the editor, and a failed send keeps what they wrote', async ({
    page
}) => {
    const sent: unknown[] = [];
    let status = 500;

    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({
            json: { user: { id: 'feedback-ada', name: 'Ada', email: 'ada@example.com' } }
        })
    );
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/feedback', async (route) => {
        sent.push(route.request().postDataJSON());
        await route.fulfill({ status, json: status === 204 ? undefined : { code: 'FAILED' } });
    });
    await page.routeWebSocket(/\/sync(\?|$)/, () => {});
    await page.goto('/');

    await page
        .getByRole('navigation', { name: 'Application' })
        .getByRole('button', { name: 'Send feedback' })
        .click();

    const dialog = page.getByRole('dialog', { name: 'Send feedback' });
    const send = dialog.getByRole('button', { name: 'Send' });

    await expect(send).toBeDisabled();
    await dialog.getByLabel('Your feedback').fill('The Share button is hard to find.');
    await send.click();
    await expect(dialog.getByRole('alert')).toHaveText(
        'Your feedback could not be sent. Try again.'
    );
    await expect(dialog.getByLabel('Your feedback')).toHaveValue(
        'The Share button is hard to find.'
    );

    status = 204;
    await send.click();
    const thanks = page.getByRole('dialog', { name: 'Thank you' });

    await expect(thanks).toBeVisible();
    expect(sent.at(-1)).toMatchObject({ message: 'The Share button is hard to find.', page: '/' });

    await thanks.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('signed out, the editor offers no feedback button', async ({ page }) => {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.goto('/');

    const bar = page.getByRole('navigation', { name: 'Application' });

    await expect(bar.getByRole('button', { name: 'Preview' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Send feedback' })).toHaveCount(0);
});
