import { expect, test } from '@playwright/test';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

test('command bar buttons act on the current selection', async ({ page }) => {
    await openEditor(page);

    const clone = page.locator('button[title="Clone current selection"]');
    const remove = page.locator('button[title="Delete selected shapes"]');

    // Nothing is selected yet, so neither command can run.
    await expect(clone).toBeDisabled();

    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await clone.click();

    await expect(shapes(page)).toHaveCount(2);
    await expect(shapes(page).locator('rect[data-cy][x="110"]')).toHaveCount(1);

    // The clone replaces the selection, so Delete removes only the clone.
    await remove.click();

    await expect(shapes(page)).toHaveCount(1);
    await expect(shapes(page).locator('rect[data-cy]')).toHaveAttribute('x', '100');
    await expect(remove).toBeDisabled();
});

test('the command bar offers no commands that do nothing', async ({ page }) => {
    await openEditor(page);

    await expect(page.getByText('Zoom in', { exact: true })).toBeVisible();
    await expect(page.getByText('Move', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Pan', { exact: true })).toHaveCount(0);
});

for (const width of [360, 700]) {
    test(`the command bar keeps every command reachable at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await openEditor(page);
        const commandLine = page.getByRole('checkbox', { name: 'Command Line', exact: true });
        await commandLine.check();
        await expect(page.getByRole('searchbox', { name: 'Command' })).toBeVisible();
        await commandLine.uncheck();
        await drawRect(page, { x: 150, y: 300 }, { x: 190, y: 340 });

        const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true });
        const commandBar = page.getByRole('list', { name: 'Commands' });
        const bounds = (await commandBar.boundingBox())!;

        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(await commandBar.evaluate((element) => element.scrollWidth)).toBeGreaterThan(
            await commandBar.evaluate((element) => element.clientWidth)
        );

        for (const button of await commandBar.getByRole('button').all()) {
            if (await button.isEnabled()) {
                await button.click({ trial: true });
            }
        }

        await zoomOut.scrollIntoViewIfNeeded();
        await expect(zoomOut).toBeVisible();
        await zoomOut.click();
        await expect(page.locator('svg#surface #camera')).toHaveAttribute(
            'transform',
            'translate(0,0) scale(0.9)'
        );
        await commandBar.getByRole('button', { name: 'Reset document', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Reset document?' })).toBeVisible();
    });
}

test('the command line runs a command on Enter and reports what it cannot run', async ({
    page
}) => {
    await openEditor(page, ['Command Line']);

    const input = page.getByRole('searchbox', { name: 'Command' });
    const camera = page.locator('svg#surface #camera');
    const message = page.locator('form', { has: input }).getByRole('status');

    await input.fill('zoom in');
    await expect(camera).toHaveAttribute('transform', 'translate(0,0) scale(1)');

    await input.press('Enter');

    await expect(camera).toHaveAttribute('transform', 'translate(0,0) scale(1.1)');
    await expect(input).toHaveValue('');

    await input.fill('fly');
    await input.press('Enter');

    await expect(message).toHaveText('Unknown command: fly');

    await input.fill('delete');
    await input.press('Enter');

    await expect(message).toHaveText('Delete is not available right now');
    await expect(input).toHaveValue('delete');
});

test('a group is pressed, moved and ungrouped as one', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });
    await drawRect(page, { x: 200, y: 100 }, { x: 240, y: 140 });

    // Box both, group them, then press one to select and move the whole group.
    await pointer(page, 'pointerdown', { x: 80, y: 80 });
    await pointer(page, 'pointermove', { x: 260, y: 160 });
    await pointer(page, 'pointerup', { x: 260, y: 160 });
    await page.keyboard.press('ControlOrMeta+g');
    await pointer(page, 'pointerdown', { x: 400, y: 400 });
    await pointer(page, 'pointerup', { x: 400, y: 400 });

    await pointer(page, 'pointerdown', { x: 120, y: 120 });
    await pointer(page, 'pointermove', { x: 120, y: 170 });
    await pointer(page, 'pointerup', { x: 120, y: 170 });

    const rects = shapes(page).locator('rect[data-cy]');

    await expect(rects.nth(0)).toHaveAttribute('y', '150');
    await expect(rects.nth(1)).toHaveAttribute('y', '150');

    await page.keyboard.press('ControlOrMeta+Shift+g');
    await pointer(page, 'pointerdown', { x: 400, y: 400 });
    await pointer(page, 'pointerup', { x: 400, y: 400 });
    await pointer(page, 'pointerdown', { x: 120, y: 170 });
    await pointer(page, 'pointermove', { x: 120, y: 200 });
    await pointer(page, 'pointerup', { x: 120, y: 200 });

    await expect(rects.nth(0)).toHaveAttribute('y', '180');
    await expect(rects.nth(1)).toHaveAttribute('y', '150');
});

test('a selected group shows one box with handles, and turns as one', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });
    await drawRect(page, { x: 200, y: 100 }, { x: 240, y: 140 });
    await pointer(page, 'pointerdown', { x: 80, y: 80 });
    await pointer(page, 'pointermove', { x: 260, y: 160 });
    await pointer(page, 'pointerup', { x: 260, y: 160 });
    await page.keyboard.press('ControlOrMeta+g');

    const groupHandles = page.locator('svg#surface [data-handle][data-group-id]');

    // Eight resize handles and a rotate handle, for the group and none for its shapes.
    await expect(groupHandles).toHaveCount(9);
    await expect(page.locator('svg#surface [data-handle][data-shape-id]')).toHaveCount(0);

    // Drag the rotate handle, above the box's middle at (170, 76), to the right of its center.
    await pointer(page, 'pointerdown', {
        x: 170,
        y: 76,
        target: '[data-group-id][data-type="rotate"]'
    });
    await pointer(page, 'pointermove', { x: 260, y: 120 });
    await pointer(page, 'pointerup', { x: 260, y: 120 });

    const rects = shapes(page).locator('rect[data-cy]');

    // The left square's center (120, 120) turns 90° about (170, 120) to (170, 70).
    await expect(rects.nth(0)).toHaveAttribute('x', '150');
    await expect(rects.nth(0)).toHaveAttribute('y', '50');
});

test('the command bar keeps copy, cut and paste in a group of their own', async ({ page }) => {
    await openEditor(page);

    const items = await page
        .locator('button[title="Copy selected shapes"]')
        .locator('xpath=ancestor::ul[1]/li')
        .evaluateAll((elements) =>
            elements.map((element) => element.querySelector('button')?.title ?? '|')
        );
    const copy = items.indexOf('Copy selected shapes');

    expect(items.slice(copy - 1, copy + 4)).toEqual([
        '|',
        'Copy selected shapes',
        'Cut selected shapes',
        'Paste copied shapes',
        '|'
    ]);
});

test('the pointer highlights a grouped shape only inside its group', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    // Box both, as a drawn shape is selected alone.
    await pointer(page, 'pointerdown', { x: 280, y: 80 });
    await pointer(page, 'pointermove', { x: 460, y: 160 });
    await pointer(page, 'pointerup', { x: 460, y: 160 });
    await page.keyboard.press('ControlOrMeta+g');
    await drawRect(page, { x: 500, y: 100 }, { x: 540, y: 140 });
    await page.mouse.click(700, 500);

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const hover = (x: number, y: number) => page.mouse.move(surface.x + x, surface.y + y);
    // A highlighted shape draws a second rectangle, around itself.
    const rectangles = (index: number) => shapes(page).nth(index).locator('rect');

    await hover(520, 120);
    await expect(rectangles(2)).toHaveCount(2);

    // Over a grouped shape, the group's box is highlighted, not the shape.
    const groupHighlight = page.locator('svg#surface #group-selections rect');

    await expect(groupHighlight).toHaveCount(0);
    await hover(320, 120);
    await expect(rectangles(0)).toHaveCount(1);
    await expect(groupHighlight).toHaveAttribute('width', '140');

    // A click selects the group, and a second one enters it.
    await page.mouse.click(surface.x + 320, surface.y + 120);
    await page.mouse.click(surface.x + 320, surface.y + 120);
    await hover(420, 120);
    await expect(rectangles(1)).toHaveCount(2);
});

test('a group is selected and dragged by its box, between its shapes', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    // Box both, as a drawn shape is selected alone.
    await pointer(page, 'pointerdown', { x: 280, y: 80 });
    await pointer(page, 'pointermove', { x: 460, y: 160 });
    await pointer(page, 'pointerup', { x: 460, y: 160 });
    await page.keyboard.press('ControlOrMeta+g');

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const at = (x: number, y: number) => [surface.x + x, surface.y + y] as const;

    await page.mouse.click(...at(700, 500));
    await expect(page.locator('[data-handle][data-group-id]')).toHaveCount(0);

    // Hovering the gap highlights the group; pressing there selects it and drags it.
    await page.mouse.move(...at(370, 120));
    await expect(page.locator('#group-selections > rect')).toHaveCount(1);

    await page.mouse.down();
    await page.mouse.move(...at(370, 220), { steps: 5 });
    await page.mouse.up();

    const rects = shapes(page).locator('rect[data-cy]');

    await expect(rects.nth(0)).toHaveAttribute('y', '200');
    await expect(rects.nth(1)).toHaveAttribute('y', '200');
    await expect(page.locator('[data-handle][data-group-id]')).toHaveCount(9);
});
