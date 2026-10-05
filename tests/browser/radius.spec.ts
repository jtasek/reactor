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

test('the radius handle shows the radius while dragged, and stays off a round square’s center', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 300, y: 200 }, { x: 400, y: 300 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const rect = shapes(page).locator('rect[data-cy]').first();
    const radiusField = page.getByLabel('Radius', { exact: true });
    const handle = page.locator('svg#surface [data-handle][data-type="radius"]');
    const target = '[data-handle][data-type="radius"]';

    await pointer(page, 'pointerdown', { x: 312, y: 212, target });
    await pointer(page, 'pointermove', { x: 320, y: 220 });
    await expect(page.locator('svg#surface').getByText('Radius 8', { exact: true })).toBeVisible();
    await pointer(page, 'pointerup', { x: 320, y: 220 });
    await expect(page.locator('svg#surface').getByText(/^Radius/)).toHaveCount(0);

    // Fully round, the handle stays in the corner's quarter rather than at the center.
    await radiusField.fill('50');
    await radiusField.press('Enter');
    await expect(handle).toHaveAttribute('cx', '325');

    await page.mouse.move(surface.x + 350, surface.y + 250);
    await page.mouse.down();
    await page.mouse.move(surface.x + 380, surface.y + 250, { steps: 4 });
    await page.mouse.up();
    await expect(rect).toHaveAttribute('x', '330');
    await expect(rect).toHaveAttribute('rx', '50');
});

test('the radius handle follows a turned rectangle, and is not offered too small or grouped', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 300, y: 200 }, { x: 400, y: 300 });

    const rect = shapes(page).locator('rect[data-cy]').first();
    const handles = page.locator('svg#surface [data-handle][data-type="radius"]');
    const target = '[data-handle][data-type="radius"]';
    const rotation = page.getByLabel('Rotation', { exact: true });

    // Turned half a turn, its top left corner is at the bottom right, so in is up and left.
    await rotation.fill('180');
    await rotation.press('Enter');
    // Shortcuts wait while a field has focus.
    await rotation.blur();
    const box = (await handles.boundingBox())!;
    const surface = (await page.locator('svg#surface').boundingBox())!;
    const at = { x: box.x + box.width / 2 - surface.x, y: box.y + box.height / 2 - surface.y };

    expect(Math.round(at.x)).toBe(388);
    await pointer(page, 'pointerdown', { ...at, target });
    await pointer(page, 'pointermove', { x: at.x - 10, y: at.y - 10 });
    await pointer(page, 'pointerup', { x: at.x - 10, y: at.y - 10 });
    await expect(rect).toHaveAttribute('rx', '10');

    // Under 40 pixels on its shorter side, it has no radius handle.
    await drawRect(page, { x: 500, y: 200 }, { x: 530, y: 260 });
    await expect(page.locator('svg#surface [data-handle]').first()).toBeAttached();
    await expect(handles).toHaveCount(0);

    // Two rectangles grouped are resized as one, without radius handles.
    await drawRect(page, { x: 600, y: 200 }, { x: 680, y: 280 });
    await expect(handles).toHaveCount(1);
    await pointer(page, 'pointerdown', { x: 490, y: 190 });
    await pointer(page, 'pointermove', { x: 700, y: 300 });
    await pointer(page, 'pointerup', { x: 700, y: 300 });
    await page.keyboard.press('ControlOrMeta+g');
    await expect(handles).toHaveCount(0);
});
