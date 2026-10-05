import { expect, test } from '@playwright/test';
import { drawRect, handles, openEditor, shapes } from './support/editor';

test('the selection’s menu fades in over the selection, runs commands and hides during a drag', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 200 }, { x: 500, y: 300 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const moveTo = (x: number, y: number, steps = 1) =>
        page.mouse.move(surface.x + x, surface.y + y, { steps });
    const toolbar = page.getByRole('toolbar', { name: 'Selection menu' });
    const menu = toolbar.locator('..');
    const button = (name: string) => toolbar.getByRole('button', { name, exact: true });

    await moveTo(700, 500);
    await expect(menu).toHaveCSS('opacity', '0');

    await moveTo(400, 250);
    await expect(menu).toHaveCSS('opacity', '1');

    // It sits above the box's top left corner, and stays while the pointer goes to it.
    const bar = (await toolbar.boundingBox())!;

    expect(Math.round(bar.x - surface.x)).toBe(300);
    expect(Math.round(bar.y + bar.height - surface.y)).toBe(190);

    await moveTo(310, 205);
    await moveTo(310, 180, 25);
    await expect(menu).toHaveCSS('opacity', '1');

    // Coming from elsewhere, the pointer does not bring it up where it would be.
    await moveTo(700, 500);
    await moveTo(310, 180);
    await expect(menu).toHaveCSS('opacity', '0');

    // During a drag it is gone.
    await moveTo(400, 250);
    await page.mouse.down();
    await moveTo(420, 270, 5);
    await expect(toolbar).toHaveCount(0);
    await page.mouse.up();
    await expect(toolbar).toHaveCount(1);

    // Up to seven buttons are in the bar, so these need no More.
    await expect(button('More')).toHaveCount(0);

    const hide = (await button('Hide').boundingBox())!;
    const clone = (await button('Clone').boundingBox())!;

    expect(clone.x).toBeGreaterThan(hide.x);
    expect(Math.abs(clone.y - hide.y)).toBeLessThan(1);

    await button('Clone').click();
    await expect(shapes(page)).toHaveCount(2);

    await button('Delete').click();
    await expect(shapes(page)).toHaveCount(1);
    await expect(toolbar).toHaveCount(0);
});

test('the menu stays inside the window at its right edge', async ({ page }) => {
    await openEditor(page);

    const { width } = page.viewportSize()!;

    await drawRect(page, { x: width - 90, y: 300 }, { x: width - 40, y: 350 });

    const toolbar = page.getByRole('toolbar', { name: 'Selection menu' });

    await expect(toolbar.getByRole('button', { name: 'Send to back', exact: true })).toBeAttached();

    const bar = (await toolbar.boundingBox())!;

    expect(bar.x + bar.width).toBeLessThanOrEqual(width);
});

test('More holds the buttons beyond seven, revealed in the bar until the pointer leaves', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 200 }, { x: 340, y: 240 });
    await drawRect(page, { x: 400, y: 200 }, { x: 440, y: 240 });
    await drawRect(page, { x: 500, y: 200 }, { x: 540, y: 240 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const moveTo = (x: number, y: number) => page.mouse.move(surface.x + x, surface.y + y);
    const boxSelect = async (from: [number, number], to: [number, number]) => {
        await moveTo(...from);
        await page.mouse.down();
        await moveTo(...to);
        await page.mouse.up();
    };

    // A group and a shape: Group and Ungroup both apply, eight buttons in all.
    await boxSelect([280, 180], [460, 260]);
    await page.keyboard.press('ControlOrMeta+g');
    await boxSelect([280, 180], [560, 260]);

    const toolbar = page.getByRole('toolbar', { name: 'Selection menu' });
    const button = (name: string) => toolbar.getByRole('button', { name, exact: true });

    await moveTo(320, 220);
    await expect(button('Ungroup')).toBeVisible();
    await expect(button('Group')).toHaveCount(0);

    await button('More').click();
    await expect(button('More')).toHaveCount(0);
    await expect(button('Group')).toBeVisible();

    await moveTo(700, 500);
    await expect(button('Group')).toHaveCount(0);
    await expect(button('More')).toHaveCount(1);

    // From the keyboard, focus goes on from More, which is gone, to what it revealed.
    await button('More').focus();
    await page.keyboard.press('Enter');
    await expect(button('Group')).toBeFocused();
});

test('a click selects a locked shape for its menu, and a drag from it does not move it', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 200 }, { x: 500, y: 300 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const moveTo = (x: number, y: number) => page.mouse.move(surface.x + x, surface.y + y);
    const drag = async (from: [number, number], to: [number, number]) => {
        await moveTo(...from);
        await page.mouse.down();
        await moveTo(...to);
        await page.mouse.up();
    };
    const click = (x: number, y: number) => drag([x, y], [x, y]);
    const selectionMenu = page.getByRole('toolbar', { name: 'Selection menu' });
    const button = (name: string) => selectionMenu.getByRole('button', { name, exact: true });
    const rect = shapes(page).locator('rect').first();

    await moveTo(400, 250);
    await button('Lock').click();
    await click(700, 500);
    await expect(selectionMenu).toHaveCount(0);

    // Hovering it shows no menu; a click selects it, without handles.
    await moveTo(400, 250);
    await expect(selectionMenu).toHaveCount(0);
    await click(400, 250);
    await expect(button('Unlock')).toHaveAttribute('aria-pressed', 'true');
    await expect(handles(page)).toHaveCount(0);

    await drag([400, 250], [450, 280]);
    await expect(rect).toHaveAttribute('x', '300');

    await click(400, 250);
    await button('Unlock').click();
    await drag([400, 250], [450, 280]);
    await expect(rect).toHaveAttribute('x', '350');
});

test('a click on a locked group, between its shapes too, selects it for its menu', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 200 }, { x: 340, y: 240 });
    await drawRect(page, { x: 440, y: 200 }, { x: 480, y: 240 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const moveTo = (x: number, y: number) => page.mouse.move(surface.x + x, surface.y + y);
    const click = async (x: number, y: number) => {
        await moveTo(x, y);
        await page.mouse.down();
        await page.mouse.up();
    };
    const selectionMenu = page.getByRole('toolbar', { name: 'Selection menu' });
    const button = (name: string) => selectionMenu.getByRole('button', { name, exact: true });

    await moveTo(280, 180);
    await page.mouse.down();
    await moveTo(500, 260);
    await page.mouse.up();
    await page.keyboard.press('ControlOrMeta+g');
    await moveTo(320, 220);
    await button('Lock').click();
    await click(700, 500);
    await expect(selectionMenu).toHaveCount(0);

    await click(390, 220);
    await expect(button('Unlock')).toHaveAttribute('aria-pressed', 'true');

    // Its menu is over the whole group's box, from the first shape's left edge.
    const bar = (await selectionMenu.boundingBox())!;

    expect(Math.round(bar.x - surface.x)).toBe(300);
});
