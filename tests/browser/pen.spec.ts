import { expect, test } from '@playwright/test';
import { openEditor, pointer, shapes } from './support/editor';

const click = async (page: Parameters<typeof openEditor>[0], at: { x: number; y: number }) => {
    await pointer(page, 'pointerdown', at);
    await pointer(page, 'pointerup', at);
};

test('the Pen places corners on clicks, curves on drags, and closes on the first point', async ({
    page
}) => {
    await openEditor(page);
    await page.keyboard.press('Shift+P');
    await click(page, { x: 300, y: 300 });
    await pointer(page, 'pointerdown', { x: 400, y: 200 });
    await pointer(page, 'pointermove', { x: 440, y: 200 });
    await pointer(page, 'pointerup', { x: 440, y: 200 });
    await click(page, { x: 500, y: 300 });
    await expect(shapes(page)).toHaveCount(0);

    await click(page, { x: 303, y: 302 });
    const path = shapes(page).locator('path[data-cy]');
    await expect(path).toHaveCount(1);
    const d = await path.getAttribute('d');
    expect(d).toMatch(/^M.*C.*Z$/);
    // The Pen is put down, so the next clicks select instead of starting a path.
    await click(page, { x: 600, y: 500 });
    await click(page, { x: 650, y: 500 });
    await expect(path).toHaveCount(1);
});

test('Enter keeps an open path, and Escape with one point drops it', async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press('Shift+P');
    await click(page, { x: 300, y: 300 });
    await click(page, { x: 400, y: 300 });
    await page.keyboard.press('Enter');
    const path = shapes(page).locator('path[data-cy]');
    await expect(path).toHaveCount(1);
    expect(await path.getAttribute('d')).not.toContain('Z');

    await page.keyboard.press('Shift+P');
    await click(page, { x: 300, y: 400 });
    await page.keyboard.press('Escape');
    await expect(path).toHaveCount(1);
});

test('choosing another tool keeps the path drawn so far', async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press('Shift+P');
    await click(page, { x: 300, y: 300 });
    await click(page, { x: 400, y: 350 });
    await page.keyboard.press('r');
    await expect(shapes(page).locator('path[data-cy]')).toHaveCount(1);
});
