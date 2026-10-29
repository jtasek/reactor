import { expect, test } from '@playwright/test';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

test('switches an instance between two component sources and keeps the choice after reload', async ({
    page
}) => {
    const base = createShape({
        type: 'rectangle',
        name: 'Base artwork',
        order: 'a0',
        position: { x: 0, y: 0 },
        size: { width: 40, height: 40 }
    });
    const wide = createShape({
        type: 'rectangle',
        name: 'Wide artwork',
        order: 'a1',
        position: { x: 100, y: 0 },
        size: { width: 80, height: 40 }
    });
    const family = createComponent({
        id: 'family',
        name: 'Card',
        sourceOnly: true,
        shapesIds: [base.id]
    });
    const alternate = createComponent({
        id: 'wide',
        name: 'Card Wide',
        sourceOnly: true,
        shapesIds: [wide.id]
    });
    const instance = createShape({
        type: 'instance',
        name: 'Card instance',
        order: 'a2',
        componentId: family.id,
        position: { x: 200, y: 200 },
        overrides: {}
    });
    const document = createDocument({
        id: 'variants',
        shapes: { [base.id]: base, [wide.id]: wide, [instance.id]: instance },
        components: { [family.id]: family, [alternate.id]: alternate }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Explorer', 'Inspector']);
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Card', exact: true })
        .click();
    await page.getByRole('combobox', { name: 'Add component variant' }).selectOption('wide');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Card instance', exact: true })
        .click();
    const variant = page.getByRole('combobox', { name: 'Component variant' });
    await expect(variant).toHaveValue('family');
    const width = page.getByRole('spinbutton', { name: 'Width' }).first();
    const drawn = page.locator('svg#surface g[transform="translate(100 200)"] rect');
    await expect(width).toHaveValue('40');
    await variant.selectOption('wide');
    await expect(variant).toHaveValue('wide');
    // The canvas draws the alternate and the instance takes its size.
    await expect(drawn).toHaveAttribute('width', '80');
    await expect(width).toHaveValue('80');
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await expect(page.locator('svg#surface')).toBeVisible();
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Card instance', exact: true })
        .click();
    await expect(variant).toHaveValue('wide');
    await expect(drawn).toHaveAttribute('width', '80');
});

test('creates and edits a variant without changing the default or losing instance overrides', async ({
    page
}) => {
    const base = createShape({
        type: 'rectangle',
        name: 'Artwork',
        order: 'a0',
        position: { x: 0, y: 0 },
        size: { width: 40, height: 40 }
    });
    const family = createComponent({
        id: 'family',
        name: 'Card',
        sourceOnly: true,
        shapesIds: [base.id],
        props: [{ id: 'opacity', key: 'opacity', label: 'Opacity', shapeId: base.id }]
    });
    const instance = createShape({
        type: 'instance',
        name: 'Card instance',
        order: 'a1',
        componentId: family.id,
        position: { x: 200, y: 200 },
        overrides: { opacity: 40 }
    });
    const document = createDocument({
        id: 'create-variant',
        shapes: { [base.id]: base, [instance.id]: instance },
        components: { [family.id]: family }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Explorer', 'Inspector']);
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const inspector = page.locator('[data-panel="inspector"]');
    await explorer.getByRole('button', { name: 'Card', exact: true }).click();
    await inspector.getByRole('button', { name: 'Create variant', exact: true }).click();
    const name = inspector.getByRole('textbox', { name: 'Name', exact: true });
    await expect(name).toHaveValue('Card variant');
    await expect(
        inspector.getByRole('button', { name: 'Create variant', exact: true })
    ).toHaveCount(0);
    await name.fill('Card Wide');
    await name.press('Enter');
    await inspector.getByRole('button', { name: 'Select Opacity', exact: true }).click();
    const width = inspector.getByRole('spinbutton', { name: 'Width', exact: true }).first();
    await width.fill('80');
    await width.press('Enter');
    await inspector.getByRole('button', { name: 'Select Card Wide source', exact: true }).click();
    await inspector.getByRole('button', { name: 'Variants of Card', exact: true }).click();
    await expect(
        inspector.getByRole('button', { name: 'Edit variant Card Wide', exact: true })
    ).toBeVisible();
    await page.screenshot({ path: 'test-results/create-component-variant.png' });
    await page.setViewportSize({ width: 390, height: 800 });
    const create = inspector.getByRole('button', { name: 'Create variant', exact: true });
    await create.scrollIntoViewIfNeeded();
    const createBox = (await create.boundingBox())!;
    const panelBox = (await inspector.boundingBox())!;
    expect(createBox.x).toBeGreaterThanOrEqual(panelBox.x);
    expect(createBox.x + createBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
    await page.screenshot({ path: 'test-results/create-component-variant-narrow.png' });
    await page.setViewportSize({ width: 1280, height: 720 });
    await explorer.getByRole('button', { name: 'Card instance', exact: true }).click();
    await expect(width).toHaveValue('40');
    const variant = inspector.getByRole('combobox', { name: 'Component variant' });
    await variant.selectOption({ label: 'Card Wide' });
    await expect(width).toHaveValue('80');
    const opacity = inspector
        .getByRole('region', { name: 'Component properties' })
        .getByRole('spinbutton', { name: 'Opacity', exact: true });
    await expect(opacity).toHaveValue('40');
    await variant.selectOption('family');
    await expect(width).toHaveValue('40');
    await expect(opacity).toHaveValue('40');
    await variant.selectOption({ label: 'Card Wide' });
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await expect(page.locator('svg#surface')).toBeVisible();
    await explorer.getByRole('button', { name: 'Card instance', exact: true }).click();
    await expect(variant.locator('option:checked')).toHaveText('Card Wide');
    await expect(width).toHaveValue('80');
    await expect(opacity).toHaveValue('40');
});
