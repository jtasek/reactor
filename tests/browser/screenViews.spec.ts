import { expect, test } from '@playwright/test';
import { createComponent, createDocument, createShape } from 'src/app/factories';
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

test('selects projected instances and ignores secondary presses during a gesture', async ({
    page
}) => {
    const source = createShape({
        type: 'rectangle',
        name: 'Source',
        order: 'a0',
        position: { x: 0, y: 0 },
        size: { width: 60, height: 40 }
    });
    const component = createComponent({ shapesIds: [source.id] });
    const instance = createShape({
        type: 'instance',
        name: 'Card',
        order: 'a1',
        componentId: component.id,
        overrides: {},
        position: { x: 120, y: 100 },
        parentFrameId: 'home'
    });
    const document = createDocument({
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                name: 'Home',
                position: { x: 100, y: 80 },
                size: { width: 200, height: 200 },
                visible: true,
                locked: false
            },
            view: {
                id: 'view',
                kind: 'view',
                screenId: 'home',
                name: 'Second',
                position: { x: 400, y: 80 },
                size: { width: 200, height: 200 },
                visible: true,
                locked: false
            }
        },
        shapes: { [source.id]: source, [instance.id]: instance },
        components: { [component.id]: component }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector', 'Explorer']);
    await page.getByRole('button', { name: 'More panels' }).click();
    const hit = page.locator('svg#surface [data-view-instance-hit]');
    await expect(hit).toHaveAttribute('width', '60');
    await hit.click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Card');

    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Second', exact: true }).click();
    await pointer(page, 'pointerdown', {
        x: 400,
        y: 150,
        target: '#frame-grips [data-frame-id="view"]'
    });
    await pointer(page, 'pointerdown', {
        pointerId: 2,
        x: 430,
        y: 110,
        target: '[data-view-instance-hit]'
    });
    await expect(page.getByLabel('Screen view properties')).toBeVisible();
    await pointer(page, 'pointercancel', { x: 400, y: 150 });
    await hit.dispatchEvent('pointerdown', { button: 2, bubbles: true });
    await expect(page.getByLabel('Screen view properties')).toBeVisible();
});
