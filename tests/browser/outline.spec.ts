import { expect, test, type Locator, type Page } from '@playwright/test';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

async function click(page: Page, x: number, y: number) {
    await pointer(page, 'pointerdown', { x, y });
    await pointer(page, 'pointerup', { x, y });
}

test('the outline lists layers as a tree, shows one layer alone, and takes dropped shapes', async ({
    page
}) => {
    await openEditor(page, ['Explorer', 'Outline']);

    // Two squares, each moved to a layer of its own while it is the selection.
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await page.keyboard.press('ControlOrMeta+Alt+l');
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await click(page, 600, 400);
    await click(page, 420, 120);
    await page.keyboard.press('ControlOrMeta+Alt+l');
    await click(page, 600, 400);

    const first = page.getByRole('button', { name: 'layer-1', exact: true });
    const second = page.getByRole('button', { name: 'layer-2', exact: true });
    const shapesOn = (layer: Locator) =>
        layer.locator('xpath=ancestor::li[1]').getByRole('button', { name: /^shape-/ });

    await expect(shapesOn(first)).toHaveCount(1);
    await expect(shapesOn(second)).toHaveCount(1);

    // Pressing a layer's name shows only that layer; pressing it again shows all.
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(shapes(page)).toHaveCount(1);
    await first.click();
    await expect(shapes(page)).toHaveCount(2);

    // The layer's star does the same, and so does the Highlight layer command, by
    // its key, for the layer of the selected shape.
    const star = (name: string) =>
        first.locator('xpath=ancestor::li[1]').getByRole('button', { name, exact: true }).first();

    await star('Highlight layer').click();
    await expect(shapes(page)).toHaveCount(1);
    await star('Show all layers').click();
    await expect(shapes(page)).toHaveCount(2);

    await click(page, 420, 120);
    await page.keyboard.press('h');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(shapes(page)).toHaveCount(1);
    await page.keyboard.press('h');
    await expect(shapes(page)).toHaveCount(2);
    await click(page, 600, 400);

    // Dropping a shape on a layer moves it there; the layer left empty goes.
    await shapesOn(second).dragTo(first);
    await expect(shapesOn(first)).toHaveCount(2);
    await expect(second).toHaveCount(0);
});

test('an item’s menu fades in under the pointer and runs commands for that item', async ({
    page
}) => {
    await openEditor(page, ['Explorer', 'Outline']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await click(page, 600, 400);

    const row = page.getByRole('button', { name: 'shape-1', exact: true }).locator('..');
    const menu = row.getByRole('toolbar', { name: 'shape-1 menu' });
    const button = (name: string) => menu.getByRole('button', { name, exact: true });

    await expect(button('Hide')).toHaveCSS('opacity', '0');
    await row.hover();
    await expect(button('Hide')).toHaveCSS('opacity', '1');

    // The More button reveals the rest in the bar. Nothing is selected: a
    // command runs for the row's shape.
    await expect(button('Clone')).toHaveCount(0);
    await button('More').click();

    await expect(button('More')).toHaveCount(0);
    await button('Clone').click();
    await expect(shapes(page)).toHaveCount(3);
    await button('Delete').click();
    await expect(shapes(page)).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'shape-1', exact: true })).toHaveCount(0);

    // A button switched on stays shown when the pointer leaves.
    const other = page.getByRole('button', { name: 'shape-3', exact: true }).locator('..');

    await other.hover();
    await other.getByRole('button', { name: 'Lock', exact: true }).click();
    await page.mouse.move(700, 500);
    await expect(other.getByRole('button', { name: 'Unlock', exact: true })).toHaveCSS(
        'opacity',
        '1'
    );
    await expect(other.getByRole('button', { name: 'Hide', exact: true })).toHaveCSS(
        'opacity',
        '0'
    );
    await other.hover();
    await other.getByRole('button', { name: 'More', exact: true }).click();
    await expect(other.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
});
