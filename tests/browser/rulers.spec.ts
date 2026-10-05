import { expect, test, type Page } from '@playwright/test';

const guideLines = (page: Page) => page.locator('svg#surface #guides g > line:first-child');

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
