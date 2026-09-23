import { expect, test, type Page } from '@playwright/test';

type PointerInit = { pointerId?: number; x: number; y: number; buttons?: number };

/** Dispatches a synthetic pointer event at surface-relative coordinates. */
async function pointer(page: Page, type: string, { pointerId = 1, x, y, buttons }: PointerInit) {
    const surface = page.locator('svg#surface');
    const box = await surface.boundingBox();

    await surface.dispatchEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: 'mouse',
        isPrimary: pointerId === 1,
        button: 0,
        buttons: buttons ?? (type === 'pointerup' || type === 'pointercancel' ? 0 : 1),
        clientX: box!.x + x,
        clientY: box!.y + y
    });
}

async function openEditor(page: Page) {
    await page.goto('/');
    await expect(page.locator('svg#surface')).toBeVisible();

    // The drawing tools live in the side bar, which is hidden by default.
    for (const control of ['Side Bar', 'Tool Bar']) {
        await page.getByRole('checkbox', { name: control, exact: true }).check();
    }
}

async function selectTool(page: Page, description: string) {
    await page.locator(`a[title="${description}"]`).dispatchEvent('click');
}

const shapes = (page: Page) => page.locator('svg#surface #shapes > g');
const handles = (page: Page) => page.locator('svg#surface [data-handle]');

async function drawRect(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    await selectTool(page, 'Draws a rectangle or square');
    await pointer(page, 'pointerdown', from);
    await pointer(page, 'pointermove', to);
    await pointer(page, 'pointerup', to);
}

test('a drawing commits once, at the release position', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');

    await pointer(page, 'pointerdown', { x: 100, y: 100 });
    await pointer(page, 'pointermove', { x: 150, y: 150 });
    await pointer(page, 'pointerup', { x: 200, y: 180 });

    await expect(shapes(page)).toHaveCount(1);
    const rect = shapes(page).locator('rect').first();
    await expect(rect).toHaveAttribute('width', '100');
    await expect(rect).toHaveAttribute('height', '80');
});

for (const interruption of ['pointercancel', 'lostpointercapture'] as const) {
    test(`${interruption} discards the drawing in progress`, async ({ page }) => {
        await openEditor(page);
        await selectTool(page, 'Draws a rectangle or square');

        await pointer(page, 'pointerdown', { x: 100, y: 100 });
        await pointer(page, 'pointermove', { x: 150, y: 150 });
        await pointer(page, interruption, { x: 150, y: 150 });
        await pointer(page, 'pointerup', { x: 150, y: 150 });

        await expect(shapes(page)).toHaveCount(0);
    });
}

test('window blur discards the drawing in progress', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');

    await pointer(page, 'pointerdown', { x: 100, y: 100 });
    await pointer(page, 'pointermove', { x: 150, y: 150 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await pointer(page, 'pointerup', { x: 150, y: 150 });

    await expect(shapes(page)).toHaveCount(0);
});

test('opening the context menu discards the drawing in progress', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');

    await pointer(page, 'pointerdown', { x: 100, y: 100 });
    await pointer(page, 'pointermove', { x: 150, y: 150 });
    await page.locator('svg#surface').dispatchEvent('contextmenu', { bubbles: true });
    await pointer(page, 'pointerup', { x: 150, y: 150 });

    await expect(shapes(page)).toHaveCount(0);
});

test('a second pointer cannot take over or commit an active gesture', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');

    await pointer(page, 'pointerdown', { pointerId: 1, x: 100, y: 100 });
    await pointer(page, 'pointermove', { pointerId: 1, x: 150, y: 150 });
    await pointer(page, 'pointerdown', { pointerId: 2, x: 300, y: 300 });
    await pointer(page, 'pointermove', { pointerId: 2, x: 320, y: 320 });
    await pointer(page, 'pointerup', { pointerId: 2, x: 320, y: 320 });
    await pointer(page, 'pointerup', { pointerId: 1, x: 200, y: 200 });

    await expect(shapes(page)).toHaveCount(1);
    const rect = shapes(page).locator('rect').first();
    await expect(rect).toHaveAttribute('x', '100');
    await expect(rect).toHaveAttribute('y', '100');
    await expect(rect).toHaveAttribute('width', '100');
});

test('ctrl-wheel does not zoom during a drag', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');

    const camera = page.locator('svg#surface #camera');
    const before = await camera.getAttribute('transform');

    await pointer(page, 'pointerdown', { x: 100, y: 100 });
    await pointer(page, 'pointermove', { x: 150, y: 150 });
    await page
        .locator('svg#surface')
        .dispatchEvent('wheel', { bubbles: true, ctrlKey: true, deltaY: -50 });

    await expect(camera).toHaveAttribute('transform', before ?? '');
    await pointer(page, 'pointerup', { x: 150, y: 150 });
});

test('a canceled marquee restores the previous selection', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await expect(handles(page).first()).toBeVisible();

    await pointer(page, 'pointerdown', { x: 400, y: 400 });
    await pointer(page, 'pointermove', { x: 450, y: 450 });
    await expect(handles(page)).toHaveCount(0);

    await pointer(page, 'pointercancel', { x: 450, y: 450 });

    await expect(handles(page).first()).toBeVisible();
});
