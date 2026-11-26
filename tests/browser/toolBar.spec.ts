import { expect, test } from '@playwright/test';
import { openEditor } from './support/editor';

test('similar tools share a button that keeps the one picked from its menu', async ({ page }) => {
    await openEditor(page);
    const tools = page.getByRole('list', { name: 'Tools' });
    const pressed = tools.getByRole('button', { pressed: true });

    await tools.getByRole('button', { name: 'Choose Ellipse, Circle' }).click();
    const menu = page.getByRole('menu', { name: 'Choose Ellipse, Circle' });

    await expect(menu.getByRole('menuitemradio', { name: /Ellipse/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await expect(pressed).toHaveAttribute('title', 'Draws a circle shape');

    await page.keyboard.press('s');
    await expect(pressed).toHaveAttribute('title', 'Selects shapes and groups ');
    await tools.getByRole('button', { name: 'Draws a circle shape', exact: true }).click();
    await expect(pressed).toHaveAttribute('title', 'Draws a circle shape');
});
