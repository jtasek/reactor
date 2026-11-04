import { expect, test } from '@playwright/test';
import { openEditor, shapes } from './support/editor';

test('live validation does not apply, then Apply and undo change both fields together', async ({
    page
}, testInfo) => {
    await openEditor(page, ['Command Line', 'Explorer']);
    const input = page.getByRole('combobox', { name: 'Command' });
    await input.fill('rectangle w=80 h=40 name="Card"');
    await input.press('Enter');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Card', exact: true })
        .click();
    const card = shapes(page).locator('rect[data-cy="Card"]');
    const preview = page.getByRole('region', { name: 'Edit preview' });
    await input.fill('w=-1');
    await expect(preview).toContainText('positive');
    await expect(card).toHaveAttribute('width', '80');
    await input.fill('w=120 h=60');
    await expect(preview).toContainText('Width: 80 → 120');
    await expect(preview).toContainText('Height: 40 → 60');
    await expect(preview.locator('[aria-live="polite"]')).toHaveText(
        '1 object will change. Nothing has been applied.'
    );
    await expect(card).toHaveAttribute('width', '80');
    await page.screenshot({ path: testInfo.outputPath('preview.png') });
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.getByRole('button', { name: 'Apply changes' })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('preview-narrow.png') });
    await page.getByRole('button', { name: 'Apply changes' }).click();
    await expect(card).toHaveAttribute('width', '120');
    await expect(card).toHaveAttribute('height', '60');
    await input.fill('undo');
    await input.press('Enter');
    await expect(card).toHaveAttribute('width', '80');
    await expect(card).toHaveAttribute('height', '40');
});

test('a changed selection updates the summary and still requires target confirmation', async ({
    page
}) => {
    await openEditor(page, ['Command Line', 'Explorer']);
    const input = page.getByRole('combobox', { name: 'Command' });
    for (const name of ['First', 'Second']) {
        await input.fill(`rectangle w=80 h=40 name="${name}"`);
        await input.press('Enter');
    }
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'First', exact: true }).click();
    await input.fill('w=120');
    const preview = page.getByRole('region', { name: 'Edit preview' });
    await expect(preview).toContainText('First');
    await explorer.getByRole('button', { name: 'Second', exact: true }).click();
    await expect(preview).toContainText('Second');
    await input.press('Enter');
    await expect(shapes(page).locator('rect[data-cy="Second"]')).toHaveAttribute('width', '80');
    await input.press('Enter');
    await expect(shapes(page).locator('rect[data-cy="Second"]')).toHaveAttribute('width', '120');
});

test('the same draft refreshes when its target changes through undo', async ({ page }) => {
    await openEditor(page, ['Command Line', 'Explorer']);
    const input = page.getByRole('combobox', { name: 'Command' });
    await input.fill('rectangle w=80 h=40 name="Card"');
    await input.press('Enter');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Card', exact: true })
        .click();
    await input.fill('w=100');
    await input.press('Enter');
    await input.fill('w=120');
    const preview = page.getByRole('region', { name: 'Edit preview' });
    await expect(preview).toContainText('Width: 100 → 120');
    await page
        .getByRole('list', { name: 'Commands' })
        .getByRole('button', { name: 'Undo', exact: true })
        .click();
    await expect(input).toHaveValue('w=120');
    await expect(preview).toContainText('Width: 80 → 120');
    await expect(shapes(page).locator('rect[data-cy="Card"]')).toHaveAttribute('width', '80');
});
