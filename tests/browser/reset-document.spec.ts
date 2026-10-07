import { expect, test } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

test('reset document asks for confirmation before clearing the current document', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 100 }, { x: 360, y: 160 });
    await expect(shapes(page)).toHaveCount(1);

    const reset = page
        .getByRole('list', { name: 'Tools', exact: true })
        .getByRole('button', { name: 'Reset document', exact: true });
    await expect(reset.locator('use')).toHaveAttribute(
        'xlink:href',
        /svg-sprite-action-symbol\.svg#ic_delete_24px$/
    );
    await reset.click();
    const dialog = page.getByRole('dialog', { name: 'Reset document?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await expect(dialog).toContainText('All shapes, layers, and other content will be removed.');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Reset document', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(shapes(page)).toHaveCount(1);
    await expect(reset).toBeFocused();

    await reset.click();
    await page
        .getByRole('dialog', { name: 'Reset document?' })
        .getByRole('button', { name: 'Reset document', exact: true })
        .click();
    await expect(shapes(page)).toHaveCount(0);
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(shapes(page)).toHaveCount(0);
});

test('the command line requests the same confirmation', async ({ page }) => {
    await openEditor(page, ['Command Line']);
    const input = page.getByRole('searchbox', { name: 'Command' });
    await input.fill('reset document');
    await input.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Reset document?' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Reset document?' })).toHaveCount(0);
});

test('the command menu also asks for confirmation and Escape cancels', async ({ page }) => {
    await openEditor(page);
    const reset = page
        .getByRole('list', { name: 'Commands' })
        .getByRole('button', { name: 'Reset document', exact: true });
    await expect(reset.locator('use')).toHaveAttribute('xlink:href', /#ic_delete_24px$/);
    await reset.click();
    await expect(page.getByRole('dialog', { name: 'Reset document?' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Reset document?' })).toHaveCount(0);
});
