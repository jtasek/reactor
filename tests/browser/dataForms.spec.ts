import { expect, test } from '@playwright/test';
import { openEditor } from './support/editor';

test('authors typed data, preserves values when fields change, reloads and undoes', async ({
    page
}, testInfo) => {
    await openEditor(page, ['Data View']);
    const panel = page.getByRole('region', { name: 'Data View', exact: true });
    await panel.getByRole('textbox', { name: 'New entity', exact: true }).fill('Customers');
    await panel.getByRole('button', { name: 'Add entity', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Field name', exact: true }).fill('Name');
    await panel.getByRole('button', { name: 'Add field', exact: true }).click();
    await panel.getByRole('button', { name: 'Add record', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Name, record 1', exact: true }).fill('Ada');
    await panel.getByRole('button', { name: 'Save Name, record 1', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Field Name', exact: true }).fill('Full name');
    await panel.getByRole('button', { name: 'Save Field Name', exact: true }).click();
    await expect(
        panel.getByRole('textbox', { name: 'Full name, record 1', exact: true })
    ).toHaveValue('Ada');
    await panel
        .getByRole('combobox', { name: 'Type for Full name', exact: true })
        .selectOption('number');
    await expect(panel.getByRole('region', { name: 'Data diagnostics' })).toContainText(
        'must be number'
    );
    await expect(
        panel.getByRole('textbox', { name: 'Full name, record 1', exact: true })
    ).toHaveValue('Ada');
    await panel.getByRole('textbox', { name: 'Full name, record 1', exact: true }).fill('invalid');
    await panel.getByRole('button', { name: 'Save Full name, record 1', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('must be number');
    await panel.getByRole('textbox', { name: 'Full name, record 1', exact: true }).fill('42');
    await panel.getByRole('button', { name: 'Save Full name, record 1', exact: true }).click();
    await expect(panel.getByRole('region', { name: 'Data diagnostics' })).toHaveCount(0);
    await page
        .getByRole('list', { name: 'Commands' })
        .getByRole('button', { name: 'Undo', exact: true })
        .click();
    await expect(
        panel.getByRole('textbox', { name: 'Full name, record 1', exact: true })
    ).toHaveValue('Ada');
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await openEditor(page, ['Data View']);
    await expect(
        panel.getByRole('textbox', { name: 'Full name, record 1', exact: true })
    ).toHaveValue('Ada');
    await panel
        .getByRole('combobox', { name: 'Type for Full name', exact: true })
        .selectOption('text');
    await panel.getByRole('textbox', { name: 'Full name, record 1', exact: true }).fill('42');
    await panel.getByRole('button', { name: 'Save Full name, record 1', exact: true }).click();
    await panel
        .getByRole('combobox', { name: 'Type for Full name', exact: true })
        .selectOption('number');
    await expect(
        panel.getByRole('button', { name: 'Save Full name, record 1', exact: true })
    ).toBeEnabled();
    await panel.getByRole('button', { name: 'Save Full name, record 1', exact: true }).click();
    await expect(panel.getByRole('region', { name: 'Data diagnostics' })).toHaveCount(0);
    await panel.getByRole('textbox', { name: 'New entity', exact: true }).fill('Zed');
    await panel.getByRole('button', { name: 'Add entity', exact: true }).click();
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await openEditor(page, ['Data View']);
    await panel.getByRole('textbox', { name: 'Entity name', exact: true }).fill('ZZZ Customers');
    await panel.getByRole('button', { name: 'Save Entity name', exact: true }).click();
    await expect(panel.getByRole('combobox', { name: 'Entity', exact: true })).toContainText(
        'ZZZ Customers'
    );
    await expect(
        panel.getByRole('textbox', { name: 'Full name, record 1', exact: true })
    ).toHaveValue('42');
    await panel.getByRole('button', { name: 'Add entity', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('data-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.getByRole('button', { name: 'Add entity', exact: true }).scrollIntoViewIfNeeded();
    await expect(panel.getByRole('button', { name: 'Add entity', exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('data-narrow.png') });
});
