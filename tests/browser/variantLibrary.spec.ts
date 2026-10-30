import { expect, test } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { variantLibrary } from '../support/variantLibrary';
import { openEditor } from './support/editor';

test('updates a source-only library family, explains retained values and undoes the update', async ({
    page
}) => {
    const { source, target } = variantLibrary();
    source.components.family.variantIds = [];
    source.components.family.props = [];
    const saved = serializePersistedState({
        currentDocumentId: target.id,
        documents: { [source.id]: source, [target.id]: target }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Library', 'Explorer', 'Inspector']);
    await page.getByRole('button', { name: 'Inspect Button', exact: true }).click();
    const inspector = page.locator('[data-panel="inspector"]');
    await expect(inspector.getByRole('region', { name: 'Component source' })).toBeVisible();
    await expect(inspector.getByRole('combobox', { name: 'Source for Label' })).toBeDisabled();
    await inspector.getByRole('button', { name: 'Update from library', exact: true }).click();
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Button instance', exact: true }).click();
    const variant = inspector.getByRole('combobox', { name: 'Component variant' });
    await expect(variant).toHaveValue('wide');
    await expect(variant.locator('option:checked')).toHaveText(
        'Unavailable variant — showing default'
    );
    await expect(
        inspector.getByRole('status').filter({ hasText: 'no longer exposed' })
    ).toBeVisible();
    await expect(page.locator('svg#surface text').filter({ hasText: /^Default$/ })).toHaveCount(2);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(variant).toHaveValue('wide');
    await expect(variant.locator('option:checked')).toHaveText('Button Wide');
    await expect(inspector.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue(
        'Continue'
    );
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(
        inspector.getByRole('status').filter({ hasText: 'no longer exposed' })
    ).toBeVisible();
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await expect(page.locator('svg#surface')).toBeVisible();
    await explorer.getByRole('button', { name: 'Button instance', exact: true }).click();
    await expect(variant).toHaveValue('wide');
    await expect(
        inspector.getByRole('status').filter({ hasText: 'no longer exposed' })
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 800 });
    await variant.scrollIntoViewIfNeeded();
    expect(await inspector.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
    );
    await page.screenshot({ path: 'test-results/variant-library-removed-narrow.png' });
    await inspector.getByRole('button', { name: 'Discard kept values', exact: true }).click();
    await expect(
        inspector.getByRole('status').filter({ hasText: 'no longer exposed' })
    ).toHaveCount(0);
    await expect(
        inspector.getByRole('button', { name: 'Discard kept values', exact: true })
    ).toHaveCount(0);
});

test('offers a replacement variant without choosing it automatically or losing the saved label', async ({
    page
}) => {
    const { source, target } = variantLibrary();
    const replacement = {
        ...source.shapes['wide-text'],
        id: 'replacement-text',
        name: 'Replacement label'
    };
    source.shapes[replacement.id] = replacement;
    source.shapesIds.push(replacement.id);
    source.components.replacement = {
        ...source.components.wide,
        id: 'replacement',
        name: 'New wide',
        shapesIds: [replacement.id],
        props: [{ id: 'label', label: 'Label', key: 'text', shapeId: replacement.id }]
    };
    source.components.family.variantIds = ['replacement'];
    const saved = serializePersistedState({
        currentDocumentId: target.id,
        documents: { [source.id]: source, [target.id]: target }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Library', 'Explorer', 'Inspector']);
    await page.getByRole('button', { name: 'Inspect Button', exact: true }).click();
    const inspector = page.locator('[data-panel="inspector"]');
    await inspector.getByRole('button', { name: 'Update from library', exact: true }).click();
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Button instance', exact: true }).click();
    const variant = inspector.getByRole('combobox', { name: 'Component variant' });
    await expect(variant).toHaveValue('wide');
    await expect(variant.locator('option:checked')).toHaveText(
        'Unavailable variant — showing default'
    );
    await expect(inspector.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue(
        'Continue'
    );
    await variant.selectOption('replacement');
    await expect(variant).toHaveValue('replacement');
    await expect(inspector.getByRole('status')).toHaveCount(0);
    await expect(page.locator('svg#surface text').filter({ hasText: /^Continue$/ })).toHaveCSS(
        'font-size',
        '32px'
    );
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await expect(page.locator('svg#surface')).toBeVisible();
    await explorer.getByRole('button', { name: 'Button instance', exact: true }).click();
    await expect(variant).toHaveValue('replacement');
    await expect(inspector.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue(
        'Continue'
    );
    await page.screenshot({ path: 'test-results/variant-library-replacement.png' });
});
