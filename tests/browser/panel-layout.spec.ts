import { expect, test, type Page } from '@playwright/test';
import { openEditor } from './support/editor';

test('clicking or slightly moving a header preserves its placement', async ({ page }) => {
    await openEditor(page);
    const header = page.locator('[data-panel="controlPanel"] > button');
    const before = await header.boundingBox();
    await header.click();
    expect(await header.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => localStorage.getItem('reactor:panel-layout'))).toBeNull();

    await page.mouse.move(before!.x + 20, before!.y + 14);
    await page.mouse.down();
    await page.mouse.move(before!.x + 22, before!.y + 14);
    await expect(page.locator('[data-zone]')).toHaveCount(0);
    await page.mouse.up();
    expect(await header.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => localStorage.getItem('reactor:panel-layout'))).toBeNull();
});

test('keyboard docking and undocking retain focus for subsequent moves', async ({ page }) => {
    await openEditor(page);
    const header = page.locator('[data-panel="controlPanel"] > button');
    await header.focus();
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(page.locator('[data-dock="left"] [data-panel="controlPanel"]')).toBeVisible();
    await expect(header).toBeFocused();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.locator('[data-dock="right"] [data-panel="controlPanel"]')).toBeVisible();
    await expect(header).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-dock] [data-panel="controlPanel"]')).toHaveCount(0);
    await expect(header).toBeFocused();
    const before = (await header.boundingBox())!;
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await header.boundingBox())!.x).toBe(before.x - 10);
    await expect(header).toBeFocused();
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-dock] [data-panel="controlPanel"]')).toHaveCount(0);
    await expect(header).toBeFocused();
});

async function setLayout(page: Page, layout: Record<string, string>) {
    await page.addInitScript((layout) => {
        localStorage.setItem(
            'reactor:panel-layout',
            JSON.stringify(
                Object.fromEntries(
                    Object.entries(layout).map(([id, dock]) => [
                        id,
                        { dock, position: { x: 0, y: 0 } }
                    ])
                )
            )
        );
    }, layout);
}

async function expectReachableHeaders(page: Page) {
    const headers = page.locator('[data-panel] > button');
    const viewport = page.viewportSize()!;

    for (const header of await headers.all()) {
        const bounds = (await header.boundingBox())!;
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 25 + 1);
        // A visible header must also be unobscured and reachable without scrolling its zone.
        await header.click({ trial: true });
    }
}

for (const dock of [
    'top-left',
    'left',
    'bottom-left',
    'top-right',
    'right',
    'bottom-right',
    'top',
    'bottom'
]) {
    test(`${dock} grows for stacked panels and keeps their headers reachable`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await setLayout(page, { sideBar: dock, controlPanel: dock, stats: dock });
        await openEditor(page);

        const zone = page.locator(`[data-dock="${dock}"]`);
        const panels = zone.locator('[data-panel]');
        await expect(panels).toHaveCount(3);
        expect((await zone.boundingBox())!.height).toBeGreaterThan(720 * 0.28);

        for (const panel of await panels.all()) {
            const bounds = (await panel.boundingBox())!;
            if (dock.includes('left')) expect(bounds.x).toBeCloseTo(0, 0);
            if (dock.includes('right')) expect(bounds.x + bounds.width).toBeCloseTo(1280, 0);
        }
        await expectReachableHeaders(page);

        await page.setViewportSize({ width: 900, height: 420 });
        await expectReachableHeaders(page);

        const handle = zone.locator('[data-panel="stats"] > button');
        const bounds = (await handle.boundingBox())!;
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.down();
        await page.mouse.move(450, 200, { steps: 5 });
        await page.mouse.up();
        await expect(zone.locator('[data-panel]')).toHaveCount(2);
        await expect
            .poll(() =>
                page.evaluate(
                    () => JSON.parse(localStorage.getItem('reactor:panel-layout')!).stats.dock
                )
            )
            .toBeNull();
    });
}

test('growing neighboring zones share space without covering headers', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    await setLayout(page, { sideBar: 'top-right', controlPanel: 'right', stats: 'bottom-right' });
    await openEditor(page);
    await expectReachableHeaders(page);

    const panels = await page.locator('[data-panel]').all();
    const bounds = await Promise.all(panels.map(async (panel) => (await panel.boundingBox())!));
    bounds.sort((a, b) => a.y - b.y);
    expect(bounds[0].y).toBe(0);
    expect(bounds[2].y + bounds[2].height).toBeCloseTo(395, 0);
    for (let index = 1; index < bounds.length; index++) {
        expect(bounds[index].y).toBeGreaterThanOrEqual(
            bounds[index - 1].y + bounds[index - 1].height
        );
    }
});
