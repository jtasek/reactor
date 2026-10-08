import { expect, test, type Page } from '@playwright/test';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

const guideLines = (page: Page) => page.locator('svg#surface #guides > line');

/** Opens the editor and turns the rulers on, after checking their code is not loaded before. */
async function openWithRulers(page: Page) {
    const loaded: string[] = [];

    page.on('request', (request) => loaded.push(request.url()));
    await page.goto('/');
    await expect(page.locator('svg#surface')).toBeVisible();
    expect(loaded.filter((url) => url.includes('/guides.'))).toEqual([]);

    await page.getByRole('checkbox', { name: 'Rulers', exact: true }).check();
    await expect(page.locator('svg#surface [data-ruler="top"]')).toBeVisible();
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(...to, { steps: 6 });
    await page.mouse.up();
}

test('loads the rulers when they are turned on, and drags guides out of them', async ({ page }) => {
    await openWithRulers(page);
    const guides = page.getByRole('checkbox', { name: 'Guides', exact: true });

    await expect(guides).not.toBeChecked();

    await drag(page, [100, 10], [100, 200]);
    await drag(page, [10, 300], [400, 300]);

    await expect(guides).toBeChecked();
    await expect(guideLines(page)).toHaveCount(2);
    await expect(guideLines(page).first()).toHaveAttribute('y1', '200');
    await expect(guideLines(page).last()).toHaveAttribute('x1', '400');
});

test('the command bar moves below the top ruler, so a guide is dragged out anywhere', async ({
    page
}) => {
    await openWithRulers(page);
    const bar = (await page.getByRole('list', { name: 'Commands' }).boundingBox())!;
    const ruler = (await page.locator('svg#surface [data-ruler="top"]').boundingBox())!;

    expect(bar.y).toBeGreaterThanOrEqual(ruler.y + ruler.height);

    // Where the command bar is across, on the ruler above it.
    const across = bar.x + bar.width / 2;

    await drag(page, [across, ruler.y + ruler.height / 2], [across, 300]);
    await expect(guideLines(page)).toHaveCount(1);
});

test('moves a guide, removes it dropped on its ruler, and Escape cancels a drag', async ({
    page
}) => {
    await openWithRulers(page);
    await drag(page, [100, 10], [100, 200]);
    await expect(guideLines(page)).toHaveAttribute('y1', '200');

    await drag(page, [300, 200], [300, 260]);
    await expect(guideLines(page)).toHaveAttribute('y1', '260');

    await page.mouse.move(300, 260);
    await page.mouse.down();
    await page.mouse.move(300, 400, { steps: 6 });
    await expect(guideLines(page)).toHaveAttribute('y1', '400');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(guideLines(page)).toHaveAttribute('y1', '260');

    await drag(page, [300, 260], [300, 8]);
    await expect(guideLines(page)).toHaveCount(0);
});

test('a guide dragged out of a ruler and dropped back on it is not added', async ({ page }) => {
    await openWithRulers(page);
    await drag(page, [100, 10], [100, 15]);
    await drag(page, [10, 300], [15, 300]);

    await expect(guideLines(page)).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Guides', exact: true })).not.toBeChecked();
});

test('a guide dragged beyond the canvas is removed', async ({ page }) => {
    await openWithRulers(page);
    const { height } = page.viewportSize()!;

    await drag(page, [100, 10], [100, 200]);
    await expect(guideLines(page)).toHaveAttribute('y1', '200');
    await drag(page, [300, 200], [300, height + 40]);

    await expect(guideLines(page)).toHaveCount(0);
});

/** Opens the editor with a rectangle from (400, 300) to (500, 400), selected, and a vertical guide on its left edge. */
async function openWithShapeOnGuide(page: Page) {
    await openEditor(page, ['Rulers']);
    await drawRect(page, { x: 400, y: 300 }, { x: 500, y: 400 });
    await page.getByRole('checkbox', { name: 'Side Bar', exact: true }).uncheck();
    await drag(page, [10, 600], [400, 600]);
    await expect(guideLines(page)).toHaveAttribute('x1', '400');
}

test('a shape on a guide takes the press, not the guide', async ({ page }) => {
    await openWithShapeOnGuide(page);

    await drag(page, [400, 350], [450, 350]);

    await expect(shapes(page).locator('rect').first()).toHaveAttribute('x', '450');
    await expect(guideLines(page)).toHaveAttribute('x1', '400');
});

test('shortcuts wait while a guide is dragged', async ({ page }) => {
    await openWithShapeOnGuide(page);

    await page.mouse.move(400, 600);
    await page.mouse.down();
    await page.mouse.move(300, 600, { steps: 4 });
    await page.keyboard.press('Delete');
    await page.mouse.up();

    await expect(shapes(page)).toHaveCount(1);
    await expect(guideLines(page)).toHaveAttribute('x1', '300');
});

test('no guide drag starts while a canvas gesture is in progress', async ({ page }) => {
    await openWithShapeOnGuide(page);

    await pointer(page, 'pointerdown', { pointerId: 1, x: 450, y: 350 });
    await pointer(page, 'pointerdown', {
        pointerId: 2,
        x: 300,
        y: 10,
        target: '[data-ruler="top"]'
    });
    await pointer(page, 'pointermove', { pointerId: 2, x: 300, y: 200 });
    await pointer(page, 'pointerup', { pointerId: 2, x: 300, y: 200 });
    await pointer(page, 'pointerup', { pointerId: 1, x: 450, y: 350 });

    await expect(guideLines(page)).toHaveCount(1);
});
