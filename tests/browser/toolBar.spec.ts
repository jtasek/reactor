import { expect, test } from '@playwright/test';
import { openEditor, pointer, selectTool, shapes } from './support/editor';

test('similar tools share a button that keeps the one picked from its menu', async ({ page }) => {
    await openEditor(page);
    const tools = page.getByRole('list', { name: 'Tools' });
    const pressed = tools.getByRole('button', { pressed: true });

    await tools.getByRole('button', { name: 'Choose Select, Move' }).click();
    const menu = page.getByRole('menu', { name: 'Choose Select, Move' });

    await expect(menu.getByRole('menuitemradio', { name: /Select/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await expect(pressed).toHaveAttribute('title', 'Move the selected shapes');

    await page.keyboard.press('r');
    await expect(pressed).toHaveAttribute('title', 'Draws a rectangle or square');
    await tools.getByRole('button', { name: 'Move the selected shapes', exact: true }).click();
    await expect(pressed).toHaveAttribute('title', 'Move the selected shapes');
});

test('Shift draws a rectangle with equal sides', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');
    await pointer(page, 'pointerdown', { x: 300, y: 300 });
    await page.keyboard.down('Shift');
    await pointer(page, 'pointermove', { x: 260, y: 220 });
    await pointer(page, 'pointerup', { x: 260, y: 220 });
    await page.keyboard.up('Shift');

    const rect = shapes(page).first().locator('rect[data-cy]');

    await expect(rect).toHaveAttribute('width', '80');
    await expect(rect).toHaveAttribute('height', '80');
    await expect(rect).toHaveAttribute('x', '220');
    await expect(rect).toHaveAttribute('y', '220');
});
