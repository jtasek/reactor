import { expect, test, type Page } from '@playwright/test';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

declare global {
    interface Window {
        measurements: number;
    }
}

/** Counts the times a shape is measured where it is drawn, which makes the browser lay out. */
async function countMeasurements(page: Page) {
    await page.addInitScript(() => {
        const measure = SVGGraphicsElement.prototype.getBBox;

        window.measurements = 0;
        SVGGraphicsElement.prototype.getBBox = function (...options) {
            window.measurements++;

            return measure.apply(this, options);
        };
    });
}

const measurements = (page: Page) => page.evaluate(() => window.measurements);

/** Starts counting again once the shapes drawn so far are measured. */
async function countFromHere(page: Page) {
    await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
    await page.evaluate(() => {
        window.measurements = 0;
    });
}

/** Two squares grouped and selected, in a box from (100, 100) to (240, 140), and one apart. */
async function drawGroupAndAnother(page: Page) {
    await countMeasurements(page);
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });
    await drawRect(page, { x: 200, y: 100 }, { x: 240, y: 140 });
    await drawRect(page, { x: 300, y: 300 }, { x: 340, y: 340 });
    await pointer(page, 'pointerdown', { x: 80, y: 80 });
    await pointer(page, 'pointermove', { x: 260, y: 160 });
    await pointer(page, 'pointerup', { x: 260, y: 160 });
    await page.keyboard.press('ControlOrMeta+g');
    await expect(page.locator('svg#surface [data-handle][data-group-id]')).toHaveCount(9);
    await countFromHere(page);
}

const rects = (page: Page) => shapes(page).locator('rect[data-cy]');

test('turning a group measures its shapes once, when it ends, and no others', async ({ page }) => {
    await drawGroupAndAnother(page);

    await pointer(page, 'pointerdown', {
        x: 170,
        y: 76,
        target: '[data-group-id][data-type="rotate"]'
    });

    for (const x of [200, 220, 240, 260]) {
        await pointer(page, 'pointermove', { x, y: 120 });
    }

    await expect(rects(page).nth(0)).toHaveAttribute('x', '150');
    expect(await measurements(page)).toBe(0);

    await pointer(page, 'pointerup', { x: 260, y: 120 });
    await expect.poll(() => measurements(page)).toBe(2);
});

test('resizing a group measures its shapes once, when it ends', async ({ page }) => {
    await drawGroupAndAnother(page);

    await pointer(page, 'pointerdown', {
        x: 240,
        y: 140,
        target: '[data-group-id][data-type="bottomRight"]'
    });

    for (const x of [280, 320, 380]) {
        await pointer(page, 'pointermove', { x, y: 180 });
    }

    // Twice as wide: the box's 140 becomes 280, and the squares' 40 becomes 80.
    await expect(rects(page).nth(0)).toHaveAttribute('width', '80');
    expect(await measurements(page)).toBe(0);

    await pointer(page, 'pointerup', { x: 380, y: 180 });
    await expect.poll(() => measurements(page)).toBe(2);
});

test('moving and resizing a shape measure it once, when the drag ends', async ({ page }) => {
    await countMeasurements(page);
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });
    await drawRect(page, { x: 300, y: 300 }, { x: 340, y: 340 });
    // A click on empty canvas, so the shape just drawn is no longer the selected one.
    await pointer(page, 'pointerdown', { x: 500, y: 100 });
    await pointer(page, 'pointerup', { x: 500, y: 100 });
    await countFromHere(page);

    await pointer(page, 'pointerdown', { x: 120, y: 120 });
    await pointer(page, 'pointermove', { x: 130, y: 130 });
    await pointer(page, 'pointermove', { x: 140, y: 140 });
    await expect(rects(page).nth(0)).toHaveAttribute('x', '120');
    expect(await measurements(page)).toBe(0);
    await pointer(page, 'pointerup', { x: 140, y: 140 });
    await expect.poll(() => measurements(page)).toBe(1);

    await pointer(page, 'pointerdown', {
        x: 160,
        y: 160,
        target: '[data-shape-id][data-type="bottomRight"]'
    });
    await pointer(page, 'pointermove', { x: 180, y: 180 });
    await pointer(page, 'pointermove', { x: 200, y: 200 });
    await expect(rects(page).nth(0)).toHaveAttribute('width', '80');
    expect(await measurements(page)).toBe(1);
    await pointer(page, 'pointerup', { x: 200, y: 200 });
    await expect.poll(() => measurements(page)).toBe(2);
});
