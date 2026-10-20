import { expect, test } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor, pointer } from './support/editor';

test('edits hug/fill and constraints, shows cycles, hit tests sizes, and reloads authored rules', async ({
    page
}) => {
    const a = createShape({
        type: 'rectangle',
        name: 'Fill item',
        order: 'a0',
        position: { x: 600, y: 600 },
        size: { width: 40, height: 30 },
        parentFrameId: 'stack'
    });
    const document = createDocument({
        id: 'sizing-document',
        frames: {
            stack: {
                id: 'stack',
                name: 'Stack',
                position: { x: 100, y: 100 },
                size: { width: 300, height: 200 },
                visible: true,
                locked: false,
                stack: { direction: 'row', gap: 10, padding: 20, align: 'start' }
            }
        },
        shapes: { [a.id]: a }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector', 'Explorer']);
    const rect = page.locator('svg#surface rect[data-cy="Fill item"]');
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Fill item', exact: true }).click();
    await page.getByLabel('Width sizing', { exact: true }).selectOption('fill');
    await expect(rect).toHaveAttribute('width', '260');
    await expect(page.getByLabel('Width', { exact: true })).not.toBeEditable();
    await page.getByLabel('Max width', { exact: true }).fill('180');
    await page.getByLabel('Max width', { exact: true }).press('Enter');
    await expect(rect).toHaveAttribute('width', '180');
    // This point is outside the authored 40px width, inside the projected 180px width.
    await pointer(page, 'pointerdown', { x: 280, y: 130 });
    await pointer(page, 'pointerup', { x: 280, y: 130 });
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Fill item');
    await explorer.getByRole('button', { name: 'Stack', exact: true }).click();
    await page.getByLabel('Height sizing', { exact: true }).selectOption('hug');
    await expect(page.getByLabel('Frame height', { exact: true })).toHaveValue('70');
    await expect(page.getByLabel('Frame height', { exact: true })).not.toBeEditable();
    await page.getByLabel('Width sizing', { exact: true }).selectOption('hug');
    await expect(page.getByRole('status').filter({ hasText: 'Sizing cycle' })).toBeVisible();
    await expect(page.getByLabel('Frame width', { exact: true })).toHaveValue('300');
    await page.getByLabel('Width sizing', { exact: true }).selectOption('fixed');
    await expect(page.getByRole('status').filter({ hasText: 'Sizing cycle' })).toHaveCount(0);
    await expect(rect).toHaveAttribute('width', '180');
    await page.getByLabel('Min height', { exact: true }).fill('90');
    await page.getByLabel('Min height', { exact: true }).press('Enter');
    await expect(page.getByLabel('Frame height', { exact: true })).toHaveValue('90');
    await page.getByLabel('Max width', { exact: true }).fill('300');
    await page.getByLabel('Max width', { exact: true }).press('Enter');
    await page.getByLabel('Frame width', { exact: true }).fill('400');
    await page.getByLabel('Frame width', { exact: true }).press('Enter');
    await expect(page.getByLabel('Frame width', { exact: true })).toHaveValue('300');
    await page.screenshot({ path: '/tmp/reactor-sizing-normal.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(page.getByLabel('Height sizing', { exact: true })).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-sizing-narrow.png' });
    await page.reload();
    await expect(rect).toHaveAttribute('width', '180');
    await explorer.getByRole('button', { name: 'Stack', exact: true }).click();
    await expect(page.getByLabel('Height sizing', { exact: true })).toHaveValue('hug');
    await expect(page.getByLabel('Min height', { exact: true })).toHaveValue('90');
});
