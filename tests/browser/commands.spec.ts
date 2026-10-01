import { expect, test } from '@playwright/test';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

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

    // The clone replaces the selection, so Delete removes only the clone.
    await remove.click();

    await expect(shapes(page)).toHaveCount(1);
    await expect(shapes(page).locator('rect[data-cy]')).toHaveAttribute('x', '100');
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
    const message = page.locator('form', { has: input }).getByRole('status');

    await input.fill('zoom in');
    await expect(camera).toHaveAttribute('transform', 'translate(0,0) scale(1)');

    await input.press('Enter');

    await expect(camera).toHaveAttribute('transform', 'translate(0,0) scale(1.1)');
    await expect(input).toHaveValue('');

    await input.fill('fly');
    await input.press('Enter');

    await expect(message).toHaveText('Unknown command: fly');

    await input.fill('delete');
    await input.press('Enter');

    await expect(message).toHaveText('Delete is not available right now');
    await expect(input).toHaveValue('delete');
});

test('a group is pressed, moved and ungrouped as one', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });
    await drawRect(page, { x: 200, y: 100 }, { x: 240, y: 140 });

    // Box both, group them, then press one to select and move the whole group.
    await pointer(page, 'pointerdown', { x: 80, y: 80 });
    await pointer(page, 'pointermove', { x: 260, y: 160 });
    await pointer(page, 'pointerup', { x: 260, y: 160 });
    await page.keyboard.press('ControlOrMeta+g');
    await pointer(page, 'pointerdown', { x: 400, y: 400 });
    await pointer(page, 'pointerup', { x: 400, y: 400 });

    await pointer(page, 'pointerdown', { x: 120, y: 120 });
    await pointer(page, 'pointermove', { x: 120, y: 170 });
    await pointer(page, 'pointerup', { x: 120, y: 170 });

    const rects = shapes(page).locator('rect[data-cy]');

    await expect(rects.nth(0)).toHaveAttribute('y', '150');
    await expect(rects.nth(1)).toHaveAttribute('y', '150');

    await page.keyboard.press('ControlOrMeta+Shift+g');
    await pointer(page, 'pointerdown', { x: 400, y: 400 });
    await pointer(page, 'pointerup', { x: 400, y: 400 });
    await pointer(page, 'pointerdown', { x: 120, y: 170 });
    await pointer(page, 'pointermove', { x: 120, y: 200 });
    await pointer(page, 'pointerup', { x: 120, y: 200 });

    await expect(rects.nth(0)).toHaveAttribute('y', '180');
    await expect(rects.nth(1)).toHaveAttribute('y', '150');
});
