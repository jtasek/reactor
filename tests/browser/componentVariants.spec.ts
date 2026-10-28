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
