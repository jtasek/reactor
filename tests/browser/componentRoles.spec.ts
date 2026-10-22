import { expect, test } from '@playwright/test';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

test('edits explicit source roles, instance customization and inheritance, and preserves them across reload', async ({
    page
}) => {
    const text = createShape({
        type: 'text',
        name: 'Caption shape',
        order: 'a0',
        position: { x: 100, y: 100 },
        value: 'Save'
    });
    const component = createComponent({
        id: 'action',
        name: 'Action',
        sourceOnly: true,
        shapesIds: [text.id],
        props: [{ id: 'caption', shapeId: text.id, key: 'text', label: 'Caption' }]
    });
    const instance = createShape({
        type: 'instance',
        name: 'Action instance',
        order: 'a1',
        componentId: component.id,
        position: { x: 200, y: 200 },
        overrides: {}
    });
    const document = createDocument({
        id: 'role-document',
        shapes: { [text.id]: text, [instance.id]: instance },
        components: { [component.id]: component }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector', 'Explorer']);
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const role = page.getByRole('combobox', { name: 'Semantic role', exact: true });
    await explorer.getByRole('button', { name: 'Action', exact: true }).click();
    await expect(role).toHaveValue('none');
    await role.selectOption('button');
    await expect(page.getByRole('status').filter({ hasText: 'Link label' })).toBeVisible();
    await page.getByLabel('Role label', { exact: true }).selectOption('caption');
    await expect(page.getByRole('status').filter({ hasText: 'Link label' })).toHaveCount(0);
    await explorer.getByRole('button', { name: 'Action instance', exact: true }).click();
    await expect(role).toHaveValue('inherit');
    await expect(page.getByLabel('Role label', { exact: true })).toHaveValue('caption');
    // Picking the source's role keeps following the source.
    await role.selectOption('button');
    await expect(role).toHaveValue('inherit');
    await page.getByLabel('Caption', { exact: true }).fill('Continue');
    await role.selectOption('text');
    await page.getByLabel('Role content', { exact: true }).selectOption('caption');
    await expect(page.getByLabel('Caption', { exact: true })).toHaveValue('Continue');
    await page.screenshot({ path: '/tmp/reactor-roles-normal.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(role).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-roles-narrow.png' });
    await page.reload();
    await explorer.getByRole('button', { name: 'Action instance', exact: true }).click();
    await expect(role).toHaveValue('text');
    await expect(page.getByLabel('Role content', { exact: true })).toHaveValue('caption');
    // Choosing the source's role on a customized instance starts from the source's links.
    await role.selectOption('button');
    await expect(page.getByLabel('Role label', { exact: true })).toHaveValue('caption');
    await expect(page.getByRole('status').filter({ hasText: 'Link label' })).toHaveCount(0);
    await role.selectOption('none');
    await expect(page.getByLabel('Role label', { exact: true })).toHaveCount(0);
    await role.selectOption('inherit');
    await expect(page.getByLabel('Role label', { exact: true })).toHaveValue('caption');
    await expect(page.getByLabel('Caption', { exact: true })).toHaveValue('Continue');
});
