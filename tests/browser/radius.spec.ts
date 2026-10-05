import { expect, test, type Page } from '@playwright/test';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

test('a rectangle’s corners are rounded by its radius handle and in the inspector', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 300, y: 200 }, { x: 500, y: 300 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const rect = shapes(page).locator('rect[data-cy]').first();
    const radiusField = page.getByLabel('Radius', { exact: true });
    const handle = page.locator(
        'svg#surface [data-handle][data-type="radius"][data-corner="topLeft"]'
    );

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
    const target = '[data-handle][data-type="radius"][data-corner="topLeft"]';

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
    const handle = page.locator(
        'svg#surface [data-handle][data-type="radius"][data-corner="topLeft"]'
    );
    const target = '[data-handle][data-type="radius"][data-corner="topLeft"]';

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
    const target = '[data-handle][data-type="radius"][data-corner="topLeft"]';
    const rotation = page.getByLabel('Rotation', { exact: true });

    // Turned half a turn, its top left corner is at the bottom right, so in is up and left.
    await rotation.fill('180');
    await rotation.press('Enter');
    // Shortcuts wait while a field has focus.
    await rotation.blur();
    const box = (await handles.and(page.locator('[data-corner="topLeft"]')).boundingBox())!;
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
    await expect(handles).toHaveCount(4);
    await pointer(page, 'pointerdown', { x: 490, y: 190 });
    await pointer(page, 'pointermove', { x: 700, y: 300 });
    await pointer(page, 'pointerup', { x: 700, y: 300 });
    await page.keyboard.press('ControlOrMeta+g');
    await expect(handles).toHaveCount(0);
});

test('each corner has a radius handle, and any of them rounds all four corners', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 200 }, { x: 500, y: 300 });

    const rect = shapes(page).locator('rect[data-cy]').first();
    const handles = page.locator('svg#surface [data-handle][data-type="radius"]');
    const corner = (name: string) => handles.and(page.locator(`[data-corner="${name}"]`));
    const target = '[data-handle][data-type="radius"][data-corner="bottomRight"]';

    await expect(handles).toHaveCount(4);
    await expect(corner('topRight')).toHaveAttribute('cx', '488');
    await expect(corner('bottomLeft')).toHaveAttribute('cy', '288');

    await pointer(page, 'pointerdown', { x: 488, y: 288, target });
    await pointer(page, 'pointermove', { x: 478, y: 278 });
    await expect(page.locator('svg#surface').getByText('Radius 10', { exact: true })).toBeVisible();
    await pointer(page, 'pointerup', { x: 478, y: 278 });

    await expect(rect).toHaveAttribute('rx', '10');
    await expect(corner('bottomRight')).toHaveAttribute('cx', '488');
    await expect(corner('topLeft')).toHaveAttribute('cx', '312');
});

type Rect = { x: number; y: number; width: number; height: number };

const overlap = (a: Rect, b: Rect) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Presses a corner's radius handle and moves it `by` on screen, leaving it pressed. */
async function pressRadiusHandle(page: Page, corner: string, by: { x: number; y: number }) {
    const surface = (await page.locator('svg#surface').boundingBox())!;
    const target = `[data-handle][data-type="radius"][data-corner="${corner}"]`;
    const box = (await page.locator(`svg#surface ${target}`).boundingBox())!;
    const at = { x: box.x + box.width / 2 - surface.x, y: box.y + box.height / 2 - surface.y };

    await pointer(page, 'pointerdown', { ...at, target });
    await pointer(page, 'pointermove', { x: at.x + by.x, y: at.y + by.y });

    return { target, end: { x: at.x + by.x, y: at.y + by.y } };
}

test('the radius badge covers no radius handle, on a turned or a short rectangle', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    const badge = page.locator('svg#surface text', { hasText: /^Radius/ });
    const handle = (corner: string) =>
        page.locator(`svg#surface [data-type="radius"][data-corner="${corner}"]`);

    // Turned a quarter, the rectangle's top is on the right of the screen.
    await drawRect(page, { x: 300, y: 200 }, { x: 500, y: 300 });
    const rotation = page.getByLabel('Rotation', { exact: true });

    await rotation.fill('90');
    await rotation.press('Enter');
    await rotation.blur();

    let { end } = await pressRadiusHandle(page, 'topLeft', { x: -6, y: 6 });

    await expect(badge).toBeVisible();
    expect(overlap((await badge.boundingBox())!, (await handle('topLeft').boundingBox())!)).toBe(
        false
    );
    await pointer(page, 'pointerup', end);

    // Forty pixels high, its top and bottom handles are twenty apart.
    await drawRect(page, { x: 300, y: 400 }, { x: 500, y: 440 });
    ({ end } = await pressRadiusHandle(page, 'topLeft', { x: 1, y: 1 }));

    await expect(badge).toBeVisible();
    for (const corner of ['topLeft', 'bottomLeft']) {
        expect(overlap((await badge.boundingBox())!, (await handle(corner).boundingBox())!)).toBe(
            false
        );
    }
    await pointer(page, 'pointerup', end);
});

test('a radius handle without a known corner rounds nothing, and a press there moves the shape', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 200 }, { x: 500, y: 300 });

    const rect = shapes(page).locator('rect[data-cy]').first();
    const surface = (await page.locator('svg#surface').boundingBox())!;

    await page
        .locator('svg#surface [data-type="radius"][data-corner="topLeft"]')
        .evaluate((handle) => handle.setAttribute('data-corner', 'middle'));
    await page.mouse.move(surface.x + 312, surface.y + 212);
    await page.mouse.down();
    await page.mouse.move(surface.x + 332, surface.y + 232, { steps: 4 });
    await page.mouse.up();

    await expect(rect).toHaveAttribute('rx', '0');
    await expect(rect).toHaveAttribute('x', '320');
});
