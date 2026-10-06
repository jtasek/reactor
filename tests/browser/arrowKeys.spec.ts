import { expect, test } from '@playwright/test';
import { drawRect, firstShape, openEditor, pointer } from './support/editor';

test('arrow keys move the selection by the step, or pan the canvas without one', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });

    const rect = firstShape(page).locator('rect[data-cy]');
    const camera = page.locator('svg#surface #camera');

    // Focus is still on the control panel's checkbox, which keeps the arrow keys.
    await expect(page.getByRole('checkbox', { name: 'Tool Bar', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(rect).toHaveAttribute('x', '100');

    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(rect).toHaveAttribute('x', '110');
    await expect(rect).toHaveAttribute('y', '110');

    // A click on empty canvas clears the selection.
    await pointer(page, 'pointerdown', { x: 400, y: 400 });
    await pointer(page, 'pointerup', { x: 400, y: 400 });
    await page.keyboard.press('ArrowRight');

    await expect(camera).toHaveAttribute('transform', 'translate(-10,0) scale(1)');
    await expect(rect).toHaveAttribute('x', '110');
});
