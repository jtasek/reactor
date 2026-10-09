import { expect, test } from '@playwright/test';
import { drawRect, openEditor, pointer, selectTool, shapes } from './support/editor';

test('places and reloads a live component instance', async ({ page }) => {
    await openEditor(page, ['Components']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const panel = page.getByRole('region', { name: 'Components' });
    await panel.getByRole('button', { name: 'Create component' }).click();
    await expect(panel.getByRole('button', { name: 'Insert' })).toBeVisible();

    await panel.getByRole('button', { name: 'Insert' }).click();
    await pointer(page, 'pointerdown', { x: 250, y: 250 });
    await pointer(page, 'pointerup', { x: 250, y: 250 });

    await expect(shapes(page)).toHaveCount(2);
    await expect(shapes(page).last().locator('rect[data-cy]')).toBeVisible();
    const before = await shapes(page).last().locator('rect[data-cy]').boundingBox();

    await selectTool(page, 'Selects shapes and groups ');
    await pointer(page, 'pointerdown', { x: 125, y: 125 });
    await pointer(page, 'pointermove', { x: 145, y: 125 });
    await pointer(page, 'pointerup', { x: 145, y: 125 });
    const after = await shapes(page).last().locator('rect[data-cy]').boundingBox();
    expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);
    expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);

    await page.reload();
    await expect(shapes(page)).toHaveCount(2);
    await expect(shapes(page).last().locator('rect[data-cy]')).toBeVisible();
});

test('an exposed fill changes one instance without changing its source', async ({ page }) => {
    await openEditor(page, ['Components', 'Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    const panel = page.getByRole('region', { name: 'Components' });

    await panel.getByRole('button', { name: 'Create component' }).click();
    await panel.getByRole('combobox', { name: /Property to expose/ }).selectOption({
        label: 'rectangle-1: Fill'
    });
    await panel.getByRole('button', { name: 'Expose property' }).click();
    await panel.getByRole('button', { name: 'Insert' }).click();
    await pointer(page, 'pointerdown', { x: 250, y: 250 });
    await pointer(page, 'pointerup', { x: 250, y: 250 });

    const fill = (index: number) =>
        shapes(page)
            .nth(index)
            .locator('rect[data-cy]')
            .evaluate((element) => getComputedStyle(element).fill);
    const original = await fill(0);
    await page.getByLabel('rectangle-1: Fill', { exact: true }).fill('#ff0000');
    await expect.poll(() => fill(1)).toBe('rgb(255, 0, 0)');
    expect(await fill(0)).toBe(original);
});
