import { expect, test } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

test('a press outside the context menu closes it, and does nothing else', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const menu = page.locator('[data-cy="context-menu"]');
    const menuItem = menu.getByRole('button', { name: 'Draws a circle shape' });
    const handles = page.locator('svg#surface [data-handle]');

    await page.mouse.click(surface.x + 500, surface.y + 300, { button: 'right' });
    await expect(menu).toBeVisible();
    await expect(handles).toHaveCount(9);

    // On the canvas: the menu closes, and the press neither deselects nor draws.
    await page.mouse.click(surface.x + 700, surface.y + 500);
    await expect(menu).toBeHidden();
    await expect(handles).toHaveCount(9);
    await expect(shapes(page)).toHaveCount(1);

    // On a panel: the menu closes too.
    await page.mouse.click(surface.x + 500, surface.y + 300, { button: 'right' });
    await expect(menu).toBeVisible();
    await page.getByText('Saved', { exact: true }).click();
    await expect(menu).toBeHidden();

    // A press on the menu itself still picks its tool.
    await page.mouse.click(surface.x + 500, surface.y + 300, { button: 'right' });
    await menuItem.click();
    await expect(
        page.getByRole('list', { name: 'Tools' }).getByRole('button', { pressed: true })
    ).toHaveAttribute('title', 'Draws a circle shape');
});
