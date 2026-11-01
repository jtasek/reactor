import { expect, test } from '@playwright/test';

test('creates, reopens and plays a form starter with editable input and an empty-state action', async ({
    page
}) => {
    await page.goto('/documents');
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Start with a template' })).toBeVisible();
    await page.screenshot({ path: 'test-results/starter-picker.png' });
    await page.getByRole('button', { name: 'Use Forms template', exact: true }).click();
    await expect(page.locator('#screen-views > g')).toHaveCount(3);
    await page.reload();
    await expect(page.locator('#screen-views > g')).toHaveCount(3);
    await page.getByRole('link', { name: 'Open prototype' }).click();
    const player = page.frameLocator('iframe[title="Application preview"]');
    await player.getByRole('button', { name: 'New request', exact: true }).click();
    await player.getByRole('textbox', { name: 'Your name', exact: true }).fill('Ada');
    await expect(player.getByRole('textbox', { name: 'Your name', exact: true })).toHaveValue(
        'Ada'
    );
    await page.screenshot({ path: 'test-results/starter-form.png' });
    await player.getByRole('button', { name: 'Preview confirmation', exact: true }).click();
    await expect(player.getByText('This is a demo. Your request has not been sent.')).toBeVisible();
    await player.getByRole('button', { name: 'Back to requests', exact: true }).click();
    await expect(player.getByRole('button', { name: 'New request', exact: true })).toBeVisible();
});

test('fits narrow screens and restores focus when dismissed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/documents');
    const open = page.getByRole('button', { name: 'Templates', exact: true });
    await open.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Use Settings template' })).toBeVisible();
    await page.screenshot({ path: 'test-results/starter-picker-narrow.png' });
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
});

for (const journey of [
    {
        name: 'List / detail',
        steps: ['See empty state', 'Explore an example project', 'Back to projects'],
        end: 'Website redesign →'
    },
    {
        name: 'Sign-in',
        steps: ['Preview email link', 'Continue demo', 'Back to sign in'],
        end: 'Preview email link'
    },
    {
        name: 'Settings',
        steps: [
            'Connected accounts',
            'Back to settings',
            'Preview saved state',
            'Back to settings'
        ],
        end: 'Connected accounts'
    }
]) {
    test(`plays the ${journey.name} starter and its empty state`, async ({ page }) => {
        await page.goto('/documents');
        expect(
            await page.evaluate(() =>
                performance
                    .getEntriesByType('resource')
                    .some((entry) => entry.name.includes('starter-templates.'))
            )
        ).toBe(false);
        await page.getByRole('button', { name: 'Templates', exact: true }).click();
        await page
            .getByRole('button', { name: `Use ${journey.name} template`, exact: true })
            .click();
        await expect(page.locator('#screen-views > g')).toHaveCount(3);
        await page.getByRole('link', { name: 'Open prototype' }).click();
        const player = page.frameLocator('iframe[title="Application preview"]');

        for (const step of journey.steps) {
            await player.getByRole('button', { name: step, exact: true }).click();
        }

        await expect(player.getByRole('button', { name: journey.end, exact: true })).toBeVisible();
    });
}
