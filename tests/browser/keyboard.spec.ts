import { expect, test } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

test('tools, list items and their toggles are buttons that work from the keyboard', async ({
    page
}) => {
    await openEditor(page, ['Explorer', 'Navigation Bar']);

    const tools = page.getByRole('list', { name: 'Tools' });
    const rectangle = tools.getByRole('button', { name: 'Draws a rectangle or square' });

    await rectangle.focus();
    await page.keyboard.press('Enter');
    await expect(rectangle).toHaveAttribute('aria-pressed', 'true');

    await drawRect(page, { x: 400, y: 300 }, { x: 480, y: 360 });
    await expect(shapes(page)).toHaveCount(1);

    // The list's toggle, not the Hide command of the command bar or of a menu.
    const hide = page.locator(
        'button[title="Hide"]:not([role="toolbar"] *):not([aria-label="Commands"] *)'
    );

    await hide.focus();
    await page.keyboard.press('Space');
    await expect(
        page.locator('button[title="Show"]:not([role="toolbar"] *):not([aria-label="Commands"] *)')
    ).toBeVisible();

    const shape = page.getByRole('button', { name: 'shape-1', exact: true });

    await shape.focus();
    await expect(shape).toBeFocused();
});
