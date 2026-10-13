import { expect, test, type Page } from '@playwright/test';
import { openEditor } from './support/editor';

test('the application rail switches left sections and the tool picker stays at the bottom', async ({
    page
}) => {
    await page.goto('/');
    const applicationBar = page.getByRole('navigation', { name: 'Application' });
    const explorer = page.locator('[data-panel="explorer"]');
    const tools = page.getByRole('list', { name: 'Tools' });
    const rail = (await applicationBar.boundingBox())!;
    const explorerBox = (await explorer.boundingBox())!;
    const toolsBox = (await tools.boundingBox())!;

    expect(explorerBox.x).toBeGreaterThanOrEqual(rail.x + rail.width);
    expect(toolsBox.y + toolsBox.height).toBeLessThanOrEqual(page.viewportSize()!.height - 25);
    expect(toolsBox.x + toolsBox.width / 2).toBeGreaterThan(explorerBox.x + explorerBox.width);

    await applicationBar.getByRole('button', { name: 'Library' }).click();
    await expect(explorer).toHaveCount(0);
    await expect(page.locator('[data-panel="components"]')).toBeVisible();
    await applicationBar.getByRole('button', { name: 'Library' }).click();
    await expect(page.locator('[data-panel="components"]')).toHaveCount(0);
    await applicationBar.getByRole('button', { name: 'Explorer' }).click();
    await expect(explorer).toBeVisible();
    await applicationBar.getByRole('button', { name: 'Inspector' }).click();
    await expect(page.locator('[data-panel="inspector"]')).toHaveCount(0);
    await applicationBar.getByRole('button', { name: 'Inspector' }).click();
    await expect(page.locator('[data-panel="inspector"]')).toBeVisible();
});

test('a bottom-docked panel pushes the tool picker upward', async ({ page }) => {
    await setLayout(page, { stats: 'bottom' });
    await openEditor(page);

    const tools = (await page.getByRole('list', { name: 'Tools' }).boundingBox())!;
    const bottomPanel = (await page.locator('[data-panel="stats"]').boundingBox())!;
    expect(tools.y + tools.height).toBeLessThanOrEqual(bottomPanel.y);
});

test('tool icons use the glass bar color in both states', async ({ page }) => {
    await page.goto('/');
    const tools = page.getByRole('list', { name: 'Tools' });
    const rectangle = tools.getByRole('button', { name: 'Draws a rectangle or square' });
    const iconColor = (button: typeof rectangle) =>
        button.evaluate((element) => ({
            button: getComputedStyle(element).color,
            icon: getComputedStyle(element.querySelector('svg')!).color
        }));

    expect((await iconColor(rectangle)).icon).toBe((await iconColor(rectangle)).button);
    await rectangle.click();
    expect((await iconColor(rectangle)).icon).toBe((await iconColor(rectangle)).button);
});

test('tools and explorer can be shown independently', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'More panels' }).click();
    const panel = page.locator('[data-panel="explorer"]');
    const tools = page.getByRole('checkbox', { name: 'Tool Bar', exact: true });
    const explorer = page.getByRole('checkbox', { name: 'Explorer', exact: true });
    const toolbar = page.getByRole('list', { name: 'Tools' });

    await expect(panel).toBeVisible();
    await expect(toolbar).toBeVisible();
    await explorer.uncheck();
    await expect(panel).toHaveCount(0);
    await explorer.check();
    await expect(panel).toBeVisible();
    await tools.uncheck();
    await expect(toolbar).toHaveCount(0);
    await expect(panel).toBeVisible();
    await explorer.uncheck();
    await expect(panel).toHaveCount(0);
});

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
        await setLayout(page, { explorer: dock, controlPanel: dock, stats: dock });
        await openEditor(page, ['Explorer']);

        const zone = page.locator(`[data-dock="${dock}"]`);
        const panels = zone.locator('[data-panel]');
        await expect(panels).toHaveCount(3);
        expect((await zone.boundingBox())!.height).toBeGreaterThan(720 * 0.28);

        for (const panel of await panels.all()) {
            const bounds = (await panel.boundingBox())!;
            if (dock.includes('left')) expect(bounds.x).toBeCloseTo(64, 0);
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
    await setLayout(page, { explorer: 'top-right', controlPanel: 'right', stats: 'bottom-right' });
    await openEditor(page, ['Explorer']);
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

const panelBox = async (page: Page, id: string) =>
    (await page.locator(`[data-panel="${id}"]`).boundingBox())!;

test('dock targets match the default width and highlight the actual drop target', async ({
    page
}) => {
    await openEditor(page);
    const width = (await panelBox(page, 'controlPanel')).width;
    const header = page.locator('[data-panel="controlPanel"] > button');
    const bounds = (await header.boundingBox())!;
    await page.mouse.move(bounds.x + 20, bounds.y + 14);
    await page.mouse.down();
    await page.mouse.move(640, 300, { steps: 5 });

    const left = page.locator('[data-zone="left"]');
    const top = page.locator('[data-zone="top"]');
    await expect(left).toBeVisible();
    expect((await left.boundingBox())!.width).toBe(width);
    expect((await top.boundingBox())!.height).toBe(56);
    await expect(left).toHaveCSS('border-top-style', 'solid');
    await expect(left).toHaveCSS('opacity', '1');
    const restingColor = await left.evaluate((node) => getComputedStyle(node).borderTopColor);

    const corner = (await page.locator('[data-zone="top-left"]').boundingBox())!;
    expect((await top.boundingBox())!.x - (corner.x + corner.width)).toBe(8);
    expect((await left.boundingBox())!.y - (corner.y + corner.height)).toBe(8);
    for (const point of [
        { x: corner.x + width + 4, y: 20 },
        { x: corner.x + 20, y: corner.height + 4 }
    ]) {
        await page.mouse.move(point.x, point.y);
        await expect
            .poll(() =>
                page
                    .locator('[data-zone]')
                    .evaluateAll(
                        (zones, color) =>
                            zones.every((zone) => getComputedStyle(zone).borderTopColor === color),
                        restingColor
                    )
            )
            .toBe(true);
    }

    // The point just outside the drawn side zone must remain a floating drop.
    await page.mouse.move(corner.x + width + 1, 300);
    await expect(left).toHaveCSS('border-top-color', restingColor);
    await page.mouse.move(corner.x + width - 1, 300);
    await expect(left).not.toHaveCSS('border-top-color', restingColor);
    await page.mouse.up();
    await expect(page.locator('[data-dock="left"] [data-panel="controlPanel"]')).toBeVisible();
});

test('a tall panel’s drag bubble follows the pointer on both axes', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem(
            'reactor:panel-layout',
            JSON.stringify({
                explorer: {
                    dock: null,
                    position: { x: 20, y: 20 },
                    size: { width: 600, height: 695 }
                }
            })
        );
    });
    await openEditor(page, ['Explorer']);
    const header = page.locator('[data-panel="explorer"] > button');
    const bounds = (await header.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(700, 250);

    const bubble = page.locator('[aria-hidden="true"]').filter({ hasText: 'Explorer' });
    await expect(bubble).toBeVisible();
    const first = (await bubble.boundingBox())!;

    await page.mouse.move(800, 450);
    await expect
        .poll(async () => {
            const next = (await bubble.boundingBox())!;

            return { x: next.x - first.x, y: next.y - first.y };
        })
        .toEqual({ x: 100, y: 200 });

    await page.mouse.move(650, 350);
    await expect
        .poll(async () => {
            const next = (await bubble.boundingBox())!;

            return { x: next.x - first.x, y: next.y - first.y };
        })
        .toEqual({ x: -50, y: 100 });
    await page.mouse.up();
    await expect(bubble).toHaveCount(0);

    const dropped = await panelBox(page, 'explorer');
    expect(dropped.y + dropped.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

test('vertical panels reject horizontal docks by keyboard, drag and saved placement', async ({
    page
}) => {
    await setLayout(page, { inspector: 'top' });
    await openEditor(page, ['Inspector']);
    const header = page.locator('[data-panel="inspector"] > button');
    await expect(page.locator('[data-dock] [data-panel="inspector"]')).toHaveCount(0);
    await header.focus();
    await page.keyboard.press('Shift+ArrowUp');
    await expect(page.locator('[data-dock] [data-panel="inspector"]')).toHaveCount(0);
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.locator('[data-dock="right"] [data-panel="inspector"]')).toBeVisible();
    await expect(header).toBeFocused();

    const bounds = (await header.boundingBox())!;
    await page.mouse.move(bounds.x + 20, bounds.y + 14);
    await page.mouse.down();
    await page.mouse.move(640, 20, { steps: 5 });
    await expect(page.locator('[data-zone]')).toHaveCount(6);
    await expect(page.locator('[data-zone="top"], [data-zone="bottom"]')).toHaveCount(0);
    await page.mouse.up();
    await expect(page.locator('[data-dock] [data-panel="inspector"]')).toHaveCount(0);
});

test('Stats switches between horizontal and vertical content when docked', async ({ page }) => {
    await openEditor(page);
    const panel = page.locator('[data-panel="stats"]');
    const header = panel.locator(':scope > button');
    await header.focus();
    await page.keyboard.press('Shift+ArrowUp');
    await expect(panel).toHaveAttribute('data-orientation', 'horizontal');
    await expect(panel.locator('[data-horizontal="true"]')).toBeVisible();
    const horizontalHeight = (await panel.boundingBox())!.height;
    await page.keyboard.press('Shift+ArrowRight');
    await expect(panel).toHaveAttribute('data-orientation', 'vertical');
    await expect(panel.locator('[data-horizontal="false"]')).toBeVisible();
    expect((await panel.boundingBox())!.height).toBeGreaterThan(horizontalHeight);
});

test('panels share a default width, keep a size dragged by a corner and restore it', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    expect((await panelBox(page, 'inspector')).width).toBe(
        (await panelBox(page, 'controlPanel')).width
    );

    const before = await panelBox(page, 'inspector');
    const corner = page.getByRole('button', { name: /^Resize Inspector/ }).last();

    await page.locator('[data-panel="inspector"]').hover();
    const grip = (await corner.boundingBox())!;

    const savedSize = () =>
        page.evaluate(
            () => JSON.parse(localStorage.getItem('reactor:panel-layout') ?? '{}').inspector?.size
        );

    // A click on the corner chooses no size.
    await page.mouse.click(grip.x + grip.width / 2, grip.y + grip.height / 2);
    expect(await savedSize()).toBeUndefined();

    // Dragged across only, the panel keeps growing with its content.
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 60, grip.y + grip.height / 2);
    await page.mouse.up();
    expect(await savedSize()).toEqual({ width: before.width + 60 });

    await expect
        .poll(async () => (await panelBox(page, 'inspector')).width)
        .toBe(before.width + 60);

    await page.reload();
    await openEditor(page, ['Inspector']);
    await expect
        .poll(async () => (await panelBox(page, 'inspector')).width)
        .toBe(before.width + 60);

    await corner.focus();
    await page.keyboard.press('ArrowRight');
    await expect
        .poll(async () => (await panelBox(page, 'inspector')).width)
        .toBe(before.width + 70);

    // A smaller window shrinks a chosen size to fit.
    await page.setViewportSize({ width: 300, height: 400 });
    await expect.poll(async () => (await panelBox(page, 'inspector')).width).toBe(300);
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.keyboard.press('Delete');
    await expect.poll(async () => (await panelBox(page, 'inspector')).width).toBe(before.width);
});

test('a panel docked to a side fills its column, and keeps its width for when it floats', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    const before = await panelBox(page, 'inspector');
    const corner = page.getByRole('button', { name: /^Resize Inspector/ }).last();
    const header = page.locator('[data-panel="inspector"] > button');
    const savedSize = () =>
        page.evaluate(
            () => JSON.parse(localStorage.getItem('reactor:panel-layout') ?? '{}').inspector?.size
        );

    await corner.focus();
    await page.keyboard.press('ArrowRight');
    await expect
        .poll(async () => (await panelBox(page, 'inspector')).width)
        .toBe(before.width + 10);

    await header.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.locator('[data-dock="right"] [data-panel="inspector"]')).toBeVisible();
    await expect
        .poll(async () => (await panelBox(page, 'inspector')).width)
        .toBe((await panelBox(page, 'controlPanel')).width);

    // Docked, its corners change only its height, and Delete restores only that.
    await corner.focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(savedSize).toEqual({ width: before.width + 10 });
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await savedSize())?.height).toBeGreaterThan(0);
    expect((await savedSize()).width).toBe(before.width + 10);
    await page.keyboard.press('Delete');
    await expect.poll(savedSize).toEqual({ width: before.width + 10 });

    await header.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-dock] [data-panel="inspector"]')).toHaveCount(0);
    await expect
        .poll(async () => (await panelBox(page, 'inspector')).width)
        .toBe(before.width + 10);
});

test('dragging a docked panel’s corner keeps the default width for when it floats', async ({
    page
}) => {
    await page.setViewportSize({ width: 600, height: 720 });
    await openEditor(page, ['Explorer']);
    const explorer = page.locator('[data-panel="explorer"]');
    const corner = page.getByRole('button', { name: /^Resize Explorer/ }).last();
    const savedSize = () =>
        page.evaluate(
            () => JSON.parse(localStorage.getItem('reactor:panel-layout') ?? '{}').explorer?.size
        );
    const column = await panelBox(page, 'explorer');
    const drag = async (dx: number, dy: number) => {
        await explorer.hover();
        const grip = (await corner.boundingBox())!;
        const x = grip.x + grip.width / 2;
        const y = grip.y + grip.height / 2;

        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + dx, y + dy, { steps: 4 });
        await page.mouse.up();
    };

    await drag(60, 0);
    expect(await savedSize()).toBeUndefined();
    expect((await panelBox(page, 'explorer')).width).toBe(column.width);

    await drag(0, -40);
    await expect.poll(savedSize).toEqual({ height: expect.any(Number) });

    await explorer.locator('> button').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-dock] [data-panel="explorer"]')).toHaveCount(0);
    // It floats at the default width, not the narrower column's.
    await expect
        .poll(async () => (await panelBox(page, 'explorer')).width)
        .toBeGreaterThan(column.width);
});

/** Saves a layout once, before the editor loads, so a reload keeps what the page changes. */
async function saveLayout(page: Page, layout: Record<string, string | null>) {
    await page.goto('/');
    await page.evaluate((layout) => {
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

const dockOrder = (page: Page, dock: string) =>
    page
        .locator(`[data-dock="${dock}"] > [data-panel]`)
        .evaluateAll((panels) => panels.map((panel) => panel.getAttribute('data-panel')));

test('a panel goes where it is dropped among the panels docked with it, also after reloading', async ({
    page
}) => {
    await saveLayout(page, { explorer: 'right', controlPanel: 'right' });
    await openEditor(page, ['Explorer']);
    const [upper, lower] = (await dockOrder(page, 'right')) as [string, string];
    const header = page.locator(`[data-panel="${upper}"] > button`);
    const from = (await header.boundingBox())!;
    const target = await panelBox(page, lower);

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height - 2, {
        steps: 8
    });
    // A line shows where it would go: below the panel under the pointer.
    const marker = page.locator('[data-dock="right"] [data-drop-marker]');
    await expect(marker).toHaveCount(1);
    expect((await marker.boundingBox())!.y).toBeGreaterThan((await panelBox(page, lower)).y);
    await page.mouse.up();

    await expect(marker).toHaveCount(0);
    await expect.poll(() => dockOrder(page, 'right')).toEqual([lower, upper]);

    await page.reload();
    await expect(page.locator('svg#surface')).toBeVisible();
    await page.getByRole('button', { name: 'More panels' }).click();
    for (const control of ['Control Panel', 'Explorer']) {
        await page.getByRole('checkbox', { name: control, exact: true }).check();
    }
    await expect.poll(() => dockOrder(page, 'right')).toEqual([lower, upper]);
});

test('the keyboard reorders a docked panel, docks one at the end and keeps its place', async ({
    page
}) => {
    await saveLayout(page, { explorer: 'right', controlPanel: 'right' });
    await openEditor(page, ['Explorer', 'Inspector']);
    const [upper, lower] = (await dockOrder(page, 'right')) as [string, string];

    await page.locator(`[data-panel="${lower}"] > button`).focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect.poll(() => dockOrder(page, 'right')).toEqual([lower, upper]);
    await expect(page.locator(`[data-panel="${lower}"] > button`)).toBeFocused();

    await page.locator('[data-panel="inspector"] > button').focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(() => dockOrder(page, 'right')).toEqual([lower, upper, 'inspector']);

    // Restoring a panel's size keeps its place in its dock.
    const corner = page.getByRole('button', { name: /^Resize Inspector/ }).last();
    await corner.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Delete');
    await expect.poll(() => dockOrder(page, 'right')).toEqual([lower, upper, 'inspector']);
});

test('a panel docked to a side sits at the top of its zone, under its corner’s panels', async ({
    page
}) => {
    await setLayout(page, { controlPanel: 'top-right', explorer: 'right' });
    await openEditor(page, ['Explorer']);
    const corner = await panelBox(page, 'controlPanel');
    const side = await panelBox(page, 'explorer');
    const gap = await page
        .locator('[data-dock="right"]')
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).rowGap));

    expect(side.y).toBeCloseTo(corner.y + corner.height + gap, 0);
});

test('the corner dock stays a target while a side panel reaches its band', async ({ page }) => {
    await saveLayout(page, { explorer: 'left', inspector: null });
    await openEditor(page, ['Explorer', 'Inspector']);
    const explorer = await panelBox(page, 'explorer');
    const header = page.locator('[data-panel="inspector"] > button');
    const from = (await header.boundingBox())!;

    // The left panel starts inside the top-left band; a drop there still docks top left.
    expect(explorer.y).toBeLessThan(20);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(explorer.x + explorer.width / 2, 20, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator('[data-dock="top-left"] [data-panel="inspector"]')).toBeVisible();
});
