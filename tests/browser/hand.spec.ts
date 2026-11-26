import { expect, test, type Page } from '@playwright/test';
import { drawRect, openEditor, pointer, selectTool, shapes } from './support/editor';

const shapeLeft = async (page: Page) => (await shapes(page).first().boundingBox())!.x;

async function drag(page: Page, buttons = 1) {
    await pointer(page, 'pointerdown', { x: 320, y: 120, buttons });
    await pointer(page, 'pointermove', { x: 380, y: 120, buttons });
    await pointer(page, 'pointerup', { x: 380, y: 120 });
}

test('the Hand, Space and the middle button drag the canvas, not the shapes', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    const surface = page.locator('svg#surface');
    const rect = shapes(page).first().locator('rect[data-cy]');
    let left = await shapeLeft(page);

    await selectTool(page, 'Drag to move around the canvas (hold Space)');
    await expect(surface).toHaveAttribute('data-pan', 'grab');
    await drag(page);
    await expect.poll(() => shapeLeft(page)).toBeCloseTo(left + 60, 0);
    await expect(rect).toHaveAttribute('x', '300');

    await page.keyboard.press('s');
    await expect(surface).not.toHaveAttribute('data-pan');
    left = await shapeLeft(page);
    await page.keyboard.down('Space');
    await expect(surface).toHaveAttribute('data-pan', 'grab');
    await drag(page);
    await page.keyboard.up('Space');
    await expect(surface).not.toHaveAttribute('data-pan');
    await expect.poll(() => shapeLeft(page)).toBeCloseTo(left + 60, 0);

    left = await shapeLeft(page);
    await drag(page, 4);
    await expect.poll(() => shapeLeft(page)).toBeCloseTo(left + 60, 0);
    await expect(rect).toHaveAttribute('x', '300');
});
