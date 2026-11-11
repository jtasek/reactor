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

    const shape = page.getByRole('button', { name: 'rectangle-1', exact: true });
    const item = shape.locator('xpath=ancestor::li[1]');

    // Space on an Explorer row hides it; its Show button then stays in the row.
    await shape.focus();
    await page.keyboard.press('Space');
    await expect(item.getByRole('button', { name: 'Show', exact: true })).toBeVisible();

    await shape.focus();
    await expect(shape).toBeFocused();
});
