import { expect, test } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

test('tools, list items and their toggles are buttons that work from the keyboard', async ({
    page
}) => {
    await openEditor(page, ['Explorer']);

    const tools = page.getByRole('list', { name: 'Tools' });
    const rectangle = tools.getByRole('button', { name: 'Draws a rectangle or square' });

    await rectangle.focus();
    await page.keyboard.press('Enter');
    await expect(rectangle).toHaveAttribute('aria-pressed', 'true');

    await drawRect(page, { x: 400, y: 300 }, { x: 480, y: 360 });
    await expect(shapes(page)).toHaveCount(1);

    const menu = page.getByRole('toolbar', { name: 'rectangle-1 menu' });
    const shape = page.getByRole('button', { name: 'rectangle-1', exact: true });

    await shape.focus();
    await menu.getByRole('button', { name: 'Hide', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(menu.getByRole('button', { name: 'Show', exact: true })).toBeVisible();

    await shape.focus();
    await expect(shape).toBeFocused();
});
