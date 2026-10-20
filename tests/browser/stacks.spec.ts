import { expect, test } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor, pointer } from './support/editor';

test('lays out fixed stacks, edits controls, hit tests projected positions and preserves free layout', async ({
    page
}) => {
    const a = createShape({
        type: 'rectangle',
        name: 'A',
        order: 'a0',
        position: { x: 600, y: 600 },
        size: { width: 40, height: 30 },
        parentFrameId: 'stack',
        layoutOrder: 0
    });
    const b = createShape({
        type: 'rectangle',
        name: 'B',
        order: 'a1',
        position: { x: 700, y: 600 },
        size: { width: 50, height: 40 },
        parentFrameId: 'stack',
        layoutOrder: 1
    });
    const document = createDocument({
        id: 'stacks-document',
        frames: {
            stack: {
                id: 'stack',
                name: 'Stack',
                visible: true,
                locked: false,
                position: { x: 100, y: 100 },
                size: { width: 300, height: 200 },
                stack: { direction: 'row', gap: 10, padding: 20, align: 'center' }
            }
        },
        shapes: { [a.id]: a, [b.id]: b }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector', 'Explorer']);
    const rect = (name: string) => page.locator(`svg#surface rect[data-cy="${name}"]`);
    await expect(rect('A')).toHaveAttribute('x', '120');
    await expect(rect('B')).toHaveAttribute('x', '170');
    await expect(rect('A')).toHaveAttribute('y', '185');
    await pointer(page, 'pointerdown', { x: 130, y: 195 });
    await pointer(page, 'pointerup', { x: 130, y: 195 });
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('A');
    await expect(page.getByLabel('X', { exact: true })).not.toBeEditable();
    await expect(page.getByLabel('Width', { exact: true })).toBeEditable();
    await page.getByLabel('Width', { exact: true }).fill('70');
    await page.getByLabel('Width', { exact: true }).press('Enter');
    await expect(rect('B')).toHaveAttribute('x', '200');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Stack', exact: true })
        .click();
    await page.getByLabel('Frame layout', { exact: true }).selectOption('column');
    await page.getByLabel('Frame alignment', { exact: true }).selectOption('end');
    await page.getByLabel('Frame gap', { exact: true }).fill('25');
    await page.getByLabel('Frame gap', { exact: true }).press('Enter');
    await page.getByLabel('Frame padding', { exact: true }).fill('15');
    await page.getByLabel('Frame padding', { exact: true }).press('Enter');
    await expect(rect('A')).toHaveAttribute('x', '315');
    await expect(rect('A')).toHaveAttribute('y', '115');
    await expect(rect('B')).toHaveAttribute('x', '335');
    await expect(rect('B')).toHaveAttribute('y', '170');
    await page.reload();
    await expect(rect('B')).toHaveAttribute('y', '170');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Stack', exact: true })
        .click();
    await expect(page.getByLabel('Frame layout', { exact: true })).toHaveValue('column');
    await page.screenshot({ path: '/tmp/reactor-stack-normal.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(page.getByLabel('Frame alignment', { exact: true })).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-stack-narrow.png' });
    await page.getByLabel('Frame layout', { exact: true }).selectOption('free');
    await expect(rect('A')).toHaveAttribute('x', '315');
    await expect(rect('B')).toHaveAttribute('y', '170');
    await page.reload();
    await expect(rect('A')).toHaveAttribute('x', '315');
});
