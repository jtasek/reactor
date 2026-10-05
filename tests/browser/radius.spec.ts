import { expect, test } from '@playwright/test';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

test('a rectangle’s corners are rounded by its radius handle and in the inspector', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 300, y: 200 }, { x: 500, y: 300 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const rect = shapes(page).locator('rect[data-cy]').first();
    const radiusField = page.getByLabel('Radius', { exact: true });
    const handle = page.locator('svg#surface [data-handle][data-type="radius"]');

    // Square, the handle stays 12 pixels in from the top left corner.
    await expect(handle).toHaveAttribute('cx', '312');
    await expect(radiusField).toHaveValue('0');

    await page.mouse.move(surface.x + 312, surface.y + 212);
    await page.mouse.down();
    await page.mouse.move(surface.x + 332, surface.y + 232, { steps: 4 });
    await page.mouse.up();

    await expect(rect).toHaveAttribute('rx', '20');
    await expect(radiusField).toHaveValue('20');
    await expect(handle).toHaveAttribute('cx', '320');

    // No more than half the shorter side.
    await radiusField.fill('80');
    await radiusField.press('Enter');
    await expect(rect).toHaveAttribute('rx', '50');
    await expect(radiusField).toHaveValue('50');

    // A canceled drag leaves the corners as they were.
    const target = '[data-handle][data-type="radius"]';

    await pointer(page, 'pointerdown', { x: 350, y: 250, target });
    await pointer(page, 'pointermove', { x: 320, y: 220 });
    await expect(rect).toHaveAttribute('rx', '20');
    await pointer(page, 'pointercancel', { x: 320, y: 220 });
    await expect(rect).toHaveAttribute('rx', '50');
});
