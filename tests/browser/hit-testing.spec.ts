import { expect, test, type Page } from '@playwright/test';
import { drawRect, handles, openEditor, pointer, selectTool } from './support/editor';

/** Clicks at a surface point: a press on a shape selects it, on empty canvas deselects. */
async function click(page: Page, x: number, y: number) {
    await pointer(page, 'pointerdown', { x, y });
    await pointer(page, 'pointerup', { x, y });
}

test('a rotated shape is pressed where it is drawn', async ({ page }) => {
    await openEditor(page);
    // 100×20 at (100, 100); its rotate handle sits 24 above the top edge's middle.
    await drawRect(page, { x: 100, y: 100 }, { x: 200, y: 120 });
    await pointer(page, 'pointerdown', { x: 150, y: 76, target: '[data-type="rotate"]' });
    await pointer(page, 'pointerup', { x: 250, y: 110 });
    await click(page, 400, 400);
    await expect(handles(page)).toHaveCount(0);

    // Rotated 90° about (150, 110) it covers x 140–160, y 60–160.
    await click(page, 190, 110);
    await expect(handles(page)).toHaveCount(0);

    await click(page, 150, 150);
    await expect(handles(page)).toHaveCount(9);
});

test('a line is pressed near its stroke, not anywhere in its bounds', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draw a straight line');
    await pointer(page, 'pointerdown', { x: 100, y: 100 });
    await pointer(page, 'pointermove', { x: 200, y: 200 });
    await pointer(page, 'pointerup', { x: 200, y: 200 });
    await click(page, 400, 400);
    await expect(handles(page)).toHaveCount(0);

    await click(page, 190, 110);
    await expect(handles(page)).toHaveCount(0);

    await click(page, 150, 152);
    await expect(handles(page)).toHaveCount(9);
});
