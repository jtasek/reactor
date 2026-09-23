import { expect, test } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

test('command bar buttons act on the current selection', async ({ page }) => {
    await openEditor(page);

    const clone = page.locator('button[title="Clone current selection"]');
    const remove = page.locator('button[title="Delete selected shapes"]');

    // Nothing is selected yet, so neither command can run.
    await expect(clone).toBeDisabled();

    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await clone.click();

    await expect(shapes(page)).toHaveCount(2);
    await expect(shapes(page).locator('rect[data-cy][x="110"]')).toHaveCount(1);

    // The clone is unselected, so Delete removes only the original.
    await remove.click();

    await expect(shapes(page)).toHaveCount(1);
    await expect(shapes(page).locator('rect[data-cy]')).toHaveAttribute('x', '110');
    await expect(remove).toBeDisabled();
});

test('the command bar offers no commands that do nothing', async ({ page }) => {
    await openEditor(page);

    await expect(page.getByText('Zoom in', { exact: true })).toBeVisible();
    await expect(page.getByText('Move', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Pan', { exact: true })).toHaveCount(0);
});

test('the command line runs a command on Enter and reports what it cannot run', async ({
    page
}) => {
    await openEditor(page, ['Command Line']);

    const input = page.getByRole('searchbox', { name: 'Command' });
    const camera = page.locator('svg#surface #camera');

    await input.fill('zoom in');
    await expect(camera).toHaveAttribute('transform', 'translate(0,0) scale(1)');

    await input.press('Enter');

    await expect(camera).toHaveAttribute('transform', 'translate(0,0) scale(1.1)');
    await expect(input).toHaveValue('');

    await input.fill('fly');
    await input.press('Enter');

    await expect(page.getByRole('status')).toHaveText('Unknown command: fly');

    await input.fill('delete');
    await input.press('Enter');

    await expect(page.getByRole('status')).toHaveText('Delete is not available right now');
    await expect(input).toHaveValue('delete');
});
