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

    // Dropping a shape on a layer moves it there; the layer left empty goes.
    await shapesOn(second).dragTo(first);
    await expect(shapesOn(first)).toHaveCount(2);
    await expect(second).toHaveCount(0);
});
