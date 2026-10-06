import { expect, test } from '@playwright/test';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

test('a dragged shape snaps to another one, showing the line, unless Ctrl or Cmd is held', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });
    await drawRect(page, { x: 300, y: 300 }, { x: 340, y: 340 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const at = (x: number, y: number) => [surface.x + x, surface.y + y] as const;
    const first = shapes(page).locator('rect[data-cy]').first();
    const snapLines = page.locator('svg#surface g[class] > path');

    // Its left edge would end at 297, three short of the other's at 300.
    await page.mouse.move(...at(120, 120));
    await page.mouse.down();
    await page.mouse.move(...at(317, 200), { steps: 8 });
    await expect(snapLines.first()).toBeVisible();
    await page.mouse.up();

    await expect(first).toHaveAttribute('x', '300');
    await expect(snapLines).toHaveCount(0);

    // Held Ctrl or Cmd, the same drag lands where the pointer puts it.
    await page.mouse.move(...at(320, 200));
    await page.keyboard.down('ControlOrMeta');
    await page.mouse.down();
    await page.mouse.move(...at(117, 200), { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('ControlOrMeta');

    await expect(first).toHaveAttribute('x', '97');
});

test('a resized shape’s edge snaps to another shape, showing the line', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });

    const handle = '[data-handle][data-type="middleRight"]';
    const resized = shapes(page).locator('rect[data-cy]').last();
    const snapLines = page.locator('svg#surface g[class] > path');

    // Its right edge would end at 297, three short of the other's left edge at 300.
    await pointer(page, 'pointerdown', { x: 140, y: 120, target: handle });
    await pointer(page, 'pointermove', { x: 297, y: 120 });
    await expect(snapLines.first()).toBeVisible();
    await pointer(page, 'pointerup', { x: 297, y: 120 });

    await expect(resized).toHaveAttribute('width', '200');
    await expect(snapLines).toHaveCount(0);
});

test('a dragged shape snaps to keep the gap of its row, measuring the equal gaps', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });
    await drawRect(page, { x: 200, y: 100 }, { x: 240, y: 140 });
    await drawRect(page, { x: 100, y: 300 }, { x: 140, y: 340 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const at = (x: number, y: number) => [surface.x + x, surface.y + y] as const;
    const moved = shapes(page).locator('rect[data-cy]').last();
    const labels = page.locator('svg#surface g[class] > text');

    // Its left edge would end at 297, three short of 60 past the second shape's right edge.
    await page.mouse.move(...at(120, 320));
    await page.mouse.down();
    await page.mouse.move(...at(317, 130), { steps: 8 });
    await expect(labels).toHaveText(['60', '60']);
    await page.mouse.up();

    await expect(moved).toHaveAttribute('x', '300');
    await expect(labels).toHaveCount(0);

    // Held Ctrl or Cmd, the drag keeps no gap and measures none.
    await page.mouse.move(...at(320, 120));
    await page.keyboard.down('ControlOrMeta');
    await page.mouse.down();
    await page.mouse.move(...at(337, 120), { steps: 8 });
    await expect(labels).toHaveCount(0);
    await page.mouse.up();
    await page.keyboard.up('ControlOrMeta');

    await expect(moved).toHaveAttribute('x', '317');
});

test('a resized shape’s snapped edge measures the distance to the shape on its line', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 100, y: 250 }, { x: 140, y: 290 });

    const handle = '[data-handle][data-type="middleRight"]';
    const labels = page.locator('svg#surface g[class] > text');

    // Its right edge would end at 297, three short of the line of the other's left edge.
    await pointer(page, 'pointerdown', { x: 140, y: 270, target: handle });
    await pointer(page, 'pointermove', { x: 297, y: 270 });
    await expect(labels).toHaveText(['110']);
    await pointer(page, 'pointerup', { x: 297, y: 270 });

    await expect(labels).toHaveCount(0);
});
