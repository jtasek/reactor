import { expect, test } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

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

    // More rolls the rest out to the right of the bar, at its height.
    await button('More').click();

    const more = (await button('More').boundingBox())!;
    const clone = (await button('Clone').boundingBox())!;

    expect(clone.x).toBeGreaterThan(more.x + more.width);
    expect(Math.abs(clone.y - more.y)).toBeLessThan(3);
    await button('Clone').click();
    await expect(shapes(page)).toHaveCount(2);

    await moveTo(430, 280);
    await button('More').click();
    await button('Delete').click();
    await expect(shapes(page)).toHaveCount(1);
    await expect(toolbar).toHaveCount(0);
});

test('More rolls out to the left of the bar without room to its right', async ({ page }) => {
    await openEditor(page);

    const { width } = page.viewportSize()!;

    await drawRect(page, { x: width - 90, y: 300 }, { x: width - 40, y: 350 });

    const toolbar = page.getByRole('toolbar', { name: 'Selection menu' });
    const button = (name: string) => toolbar.getByRole('button', { name, exact: true });

    await button('More').dispatchEvent('click');

    const more = (await button('More').boundingBox())!;
    const buttons = await Promise.all(
        ['Clone', 'Delete', 'Bring to front', 'Send to back'].map((name) =>
            button(name).boundingBox()
        )
    );

    for (const box of buttons) {
        expect(box!.x + box!.width).toBeLessThan(more.x);
        expect(box!.x).toBeGreaterThan(0);
    }
});
