import { expect, test } from '@playwright/test';
import { dataListFixture } from '../support/dataList';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

test('binds an item template in Inspector, previews records independently and preserves binding after reload', async ({
    page
}, testInfo) => {
    const { document, instance } = dataListFixture();
    delete instance.dataList;
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await openEditor(page, ['Inspector', 'Explorer']);
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Name field', exact: true })
        .click();
    const list = page.getByRole('region', { name: 'Data binding', exact: true });
    await list.getByLabel('Entity', { exact: true }).selectOption('customers');
    await list.getByLabel('Data field for Label', { exact: true }).selectOption('name');
    await list.getByLabel('Item gap', { exact: true }).fill('12');
    await list.getByLabel('Item gap', { exact: true }).press('Enter');
    await expect(list).toContainText('2 items in Prototype');
    await page.screenshot({ path: testInfo.outputPath('list-inspector.png') });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.frameLocator('iframe[title="Application preview"]');
    await expect(
        preview.getByRole('list', { name: 'Customers' }).getByRole('listitem')
    ).toHaveCount(2);
    await expect(preview.getByRole('textbox', { name: 'Ada', exact: true })).toHaveValue('Ada');
    await preview.getByRole('textbox', { name: 'Ada', exact: true }).fill('Edited locally');
    await expect(preview.getByRole('textbox', { name: 'Grace', exact: true })).toHaveValue('Grace');
    await page.reload();
    await openEditor(page, ['Inspector', 'Explorer']);
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Name field', exact: true })
        .click();
    await expect(list.getByLabel('Entity', { exact: true })).toHaveValue('customers');
    await expect(list.getByLabel('Item gap', { exact: true })).toHaveValue('12');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(preview.getByRole('textbox', { name: 'Ada', exact: true })).toHaveValue('Ada');
    await page.screenshot({ path: testInfo.outputPath('list-preview.png') });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.setViewportSize({ width: 600, height: 850 });
    await list.getByLabel('Entity', { exact: true }).scrollIntoViewIfNeeded();
    await expect(list.getByLabel('Entity', { exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('list-narrow.png') });
});

test('keeps Preview running while a new record is blank and warns before deleting a field a list uses', async ({
    page
}) => {
    const { document } = dataListFixture();
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await openEditor(page, ['Data View']);
    const panel = page.getByRole('region', { name: 'Data View', exact: true });
    await panel.getByRole('button', { name: 'Add record', exact: true }).click();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.frameLocator('iframe[title="Application preview"]');
    await expect(
        preview.getByRole('list', { name: 'Customers' }).getByRole('listitem')
    ).toHaveCount(3);
    await expect(preview.getByRole('textbox', { name: 'Grace', exact: true })).toHaveValue('Grace');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await panel.getByRole('button', { name: 'Delete Name…', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText(
        'A data binding uses this field. Bound properties will show component values instead.'
    );
});
