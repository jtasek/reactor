import { expect, test, type Page } from '@playwright/test';
import { openEditor, pointer, shapes } from './support/editor';

const activeTool = (page: Page) => page.locator('li[data-active="true"] a');

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    await pointer(page, 'pointerdown', from);
    await pointer(page, 'pointermove', to);
    await pointer(page, 'pointerup', to);
}

test('keys pick tools and run commands on the selection', async ({ page }) => {
    await openEditor(page);

    await page.keyboard.press('r');
    await expect(activeTool(page)).toHaveAttribute('title', 'Draws a rectangle or square');

    await drag(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await expect(shapes(page)).toHaveCount(1);

    await page.keyboard.press('ControlOrMeta+d');
    await expect(shapes(page)).toHaveCount(2);

    // The clone is unselected, so Delete removes only the original.
    await page.keyboard.press('Delete');
    await expect(shapes(page)).toHaveCount(1);
    await expect(shapes(page).locator('rect[data-cy]')).toHaveAttribute('x', '110');

    await page.keyboard.press('+');
    await expect(page.locator('svg#surface #camera')).toHaveAttribute(
        'transform',
        'translate(0,0) scale(1.1)'
    );
});

test('typing in a text field does not trigger shortcuts', async ({ page }) => {
    await openEditor(page, ['Command Line']);

    const input = page.getByRole('searchbox', { name: 'Command' });

    await input.click();
    await page.keyboard.type('rect');

    await expect(input).toHaveValue('rect');
    await expect(activeTool(page)).toHaveAttribute('title', 'Selects shapes and groups ');
});
