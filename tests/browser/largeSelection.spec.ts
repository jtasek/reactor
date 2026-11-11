import { expect, test } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';

/** A grid of 30 small squares, 6 by 5, from (500, 250), 20 apart, clear of the panels. */
test.beforeEach(async ({ page }) => {
    const shapes = Array.from({ length: 30 }, (_, index) =>
        createShape({
            type: 'rectangle',
            name: `Box ${index + 1}`,
            order: `a${String(index).padStart(3, '0')}`,
            position: { x: 500 + (index % 6) * 20, y: 250 + Math.floor(index / 6) * 20 },
            size: { width: 10, height: 10 },
            selected: false
        })
    );
    const document = createDocument({
        shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape]))
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });

    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.goto('/');
    await expect(page.locator('svg#surface #shapes > g')).toHaveCount(30);
});

/** Drags a marquee around the first `count` shapes in reading order, rows of six. */
async function marquee(page: import('@playwright/test').Page, count: number) {
    const boxes = await page
        .locator('svg#surface #shapes > g')
        .evaluateAll((shapes) =>
            shapes.map((shape) => shape.getBoundingClientRect()).map(({ x, y }) => ({ x, y }))
        );
    const rows = [...new Set(boxes.map(({ y }) => Math.round(y)))].sort((a, b) => a - b);
    const columns = [...new Set(boxes.map(({ x }) => Math.round(x)))].sort((a, b) => a - b);
    const lastRow = Math.floor((count - 1) / 6);
    const lastColumn = count > 6 ? 5 : count - 1;

    await page.mouse.move(columns[0] - 5, rows[0] - 5);
    await page.mouse.down();
    await page.mouse.move(columns[0] + 2, rows[0] + 2);
    await page.mouse.move(columns[lastColumn] + 13, rows[lastRow] + 13);
    await page.mouse.up();
}

/** Clicks empty canvas, far from the shapes. */
async function unselect(page: import('@playwright/test').Page) {
    const surface = (await page.locator('svg#surface').boundingBox())!;

    await page.mouse.click(surface.x + surface.width - 300, surface.y + surface.height - 60);
    await expect(page.locator('#status-selection')).toContainText('[0]');
}

test('a large selection shows one box and size instead of handles on every shape', async ({
    page
}) => {
    const handles = page.locator('svg#surface [data-handle]');
    const sizes = page.locator('svg#surface [data-size-label]');
    const box = page.locator('svg#surface [data-large-selection]');

    // Two shapes: each has its handles and size, and there is no shared box.
    await marquee(page, 2);
    await expect(page.locator('#status-selection')).toContainText('[2]');
    await expect(sizes).toHaveCount(2);
    expect(await handles.count()).toBeGreaterThan(0);
    await expect(box).toHaveCount(0);

    // All thirty: one box around them, one size, and no handles.
    await unselect(page);
    await marquee(page, 30);
    await expect(page.locator('#status-selection')).toContainText('[30]');
    await expect(box).toHaveCount(1);
    await expect(handles).toHaveCount(0);
    await expect(sizes).toHaveCount(1);
    await expect(sizes).toHaveText('110 x 90');

    // Back to a few: handles return and the box goes.
    await unselect(page);
    await marquee(page, 1);
    await expect(box).toHaveCount(0);
    await expect(sizes).toHaveCount(1);
    expect(await handles.count()).toBeGreaterThan(0);
});
