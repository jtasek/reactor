import { expect, test } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

test('the document menu highlights a layer and restores all layers', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await page.keyboard.press('ControlOrMeta+Alt+l');
    await drawRect(page, { x: 500, y: 100 }, { x: 540, y: 140 });
    await page.keyboard.press('ControlOrMeta+Alt+l');

    const trigger = page.getByRole('button', { name: /: highlight a layer$/ });
    const menu = page.getByRole('dialog', { name: 'Document layers' });
    await expect(trigger).toContainText('document-1');
    const bounds = (await trigger.boundingBox())!;
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
    await trigger.click();
    await menu.getByRole('button', { name: 'layer-1', exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(shapes(page)).toHaveCount(1);
    await expect(trigger).toBeFocused();

    await trigger.click();
    const firstLayer = menu.getByRole('button', { name: 'layer-1', exact: true });
    await expect(firstLayer).toHaveAttribute('aria-pressed', 'true');
    await expect(firstLayer).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('button', { name: 'layer-2', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(shapes(page)).toHaveCount(1);
    await trigger.click();
    await expect(menu.getByRole('button', { name: 'layer-2', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await menu.getByRole('button', { name: 'Show all layers' }).click();
    await expect(shapes(page)).toHaveCount(2);
});

test('the empty layer menu supports keyboard and outside-click dismissal', async ({ page }) => {
    await openEditor(page);
    const trigger = page.getByRole('button', { name: /: highlight a layer$/ });
    const menu = page.getByRole('dialog', { name: 'Document layers' });
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(menu).toContainText('No layers available');
    await expect(menu.getByRole('button', { name: 'Show all layers' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await page.mouse.click(600, 400);
    await expect(menu).toHaveCount(0);
});

test('the shared layer panel can detach, dock and return with its controls intact', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await page.keyboard.press('ControlOrMeta+Alt+l');
    const trigger = page.getByRole('button', { name: /: highlight a layer$/ });
    const menu = page.getByRole('dialog', { name: 'Document layers' });
    await trigger.click();
    await menu.getByRole('button', { name: 'Hide layer-1', exact: true }).click();
    await expect(shapes(page)).toHaveCount(0);
    await menu.getByRole('button', { name: 'Show layer-1', exact: true }).click();
    await expect(shapes(page)).toHaveCount(1);
    await menu.getByRole('button', { name: 'Lock layer-1', exact: true }).click();
    await expect(menu.getByRole('button', { name: 'Unlock layer-1', exact: true })).toBeVisible();

    await menu.getByRole('button', { name: 'Detach panel' }).click();
    const panel = page.locator('[data-panel="layerPanel"]');
    await expect(panel).toBeVisible();
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Layers', exact: true })).toHaveCount(1);
    await expect(panel.getByRole('button', { name: 'Unlock layer-1', exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'layer-1', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'layer-1', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await panel.locator(':scope > button').focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.locator('[data-dock="right"] [data-panel="layerPanel"]')).toBeVisible();

    await trigger.click();
    await expect(menu.getByRole('region', { name: 'Layers', exact: true })).toHaveCount(0);
    await menu.getByRole('button', { name: 'Return layers to document menu' }).click();
    await expect(panel).toHaveCount(0);
    await expect(menu.getByRole('button', { name: 'layer-1', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await expect(menu.getByRole('button', { name: 'Unlock layer-1', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Layers', exact: true })).toHaveCount(1);
    await menu.getByRole('button', { name: 'Detach panel' }).click();
    await panel.getByRole('button', { name: 'Return to document menu' }).click();
    await expect(panel).toHaveCount(0);
    await trigger.click();
    await expect(menu.getByRole('region', { name: 'Layers', exact: true })).toBeVisible();
});
