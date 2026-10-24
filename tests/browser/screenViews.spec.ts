import { expect, test } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor, pointer } from './support/editor';

test('places a second view, resolves its width, edits shared content and deletes only the view', async ({
    page
}) => {
    const body = createShape({
        type: 'rectangle',
        name: 'Body',
        order: 'a0',
        position: { x: 120, y: 100 },
        size: { width: 40, height: 30 },
        parentFrameId: 'home',
        sizing: { width: { mode: 'fill' } }
    });
    const document = createDocument({
        id: 'screen-views-browser',
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                name: 'Home',
                position: { x: 100, y: 80 },
                size: { width: 300, height: 200 },
                stack: { direction: 'column', gap: 0, padding: 10, align: 'start' },
                visible: true,
                locked: false
            }
        },
        shapes: { [body.id]: body }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });

    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector', 'Explorer']);
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Create view of screen' }).click();
    await expect(page.getByLabel('Screen view properties')).toBeVisible();
    await expect(explorer.getByRole('button', { name: 'Home view' })).toHaveAccessibleDescription(
        'Home · 300 × 200 View'
    );

    const original = page.locator('svg#surface #shapes rect[data-cy="Body"]');
    const projected = page.locator('svg#surface #screen-views rect[data-cy="Body"]');
    await expect(original).toHaveAttribute('width', '280');
    await expect(projected).toHaveAttribute('x', '450');
    const viewId = await page
        .locator('svg#surface #frames > [data-frame]')
        .filter({ hasText: 'Home view' })
        .getAttribute('data-frame');
    await pointer(page, 'pointerdown', {
        x: 440,
        y: 140,
        target: `#frame-grips [data-frame-id="${viewId}"]`
    });
    await pointer(page, 'pointermove', { x: 470, y: 140 });
    await pointer(page, 'pointercancel', { x: 470, y: 140 });
    await expect(page.getByLabel('View x')).toHaveValue('440');
    await expect(projected).toHaveAttribute('x', '450');
    await page.getByLabel('View width').fill('500');
    await page.getByLabel('View width').press('Enter');
    await expect(projected).toHaveAttribute('width', '480');
    await expect(original).toHaveAttribute('width', '280');

    await pointer(page, 'pointerdown', {
        x: 460,
        y: 100,
        target: '#screen-views rect[data-cy="Body"]'
    });
    await pointer(page, 'pointerup', {
        x: 460,
        y: 100,
        target: '#screen-views rect[data-cy="Body"]'
    });
    await page.getByLabel('Name', { exact: true }).fill('Heading');
    await page.getByLabel('Name', { exact: true }).press('Enter');
    await expect(page.locator('svg#surface #shapes rect[data-cy="Heading"]')).toHaveCount(1);
    await expect(page.locator('svg#surface #screen-views rect[data-cy="Heading"]')).toHaveCount(1);

    await explorer.getByRole('button', { name: 'Home view' }).click();
    await page.screenshot({ path: '/tmp/reactor-screen-views.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(page.getByLabel('View width')).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-screen-views-narrow.png' });
    await page.getByRole('button', { name: 'Delete view' }).click();
    await expect(page.locator('svg#surface #screen-views [data-shape-id]')).toHaveCount(0);
    await expect(explorer.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
    await page.reload();
    await expect(explorer.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
});
