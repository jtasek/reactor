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

test('authors choice and reference fields and names referenced records', async ({ page }) => {
    await openEditor(page, ['Data View']);
    const panel = page.getByRole('region', { name: 'Data View', exact: true });
    const addEntity = async (name: string) => {
        await panel.getByRole('textbox', { name: 'New entity', exact: true }).fill(name);
        await panel.getByRole('button', { name: 'Add entity', exact: true }).click();
    };
    await addEntity('Customers');
    await panel.getByRole('textbox', { name: 'Field name', exact: true }).fill('Name');
    await panel.getByRole('button', { name: 'Add field', exact: true }).click();
    await panel.getByRole('button', { name: 'Add record', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Name, record 1', exact: true }).fill('Ada');
    await panel.getByRole('button', { name: 'Save Name, record 1', exact: true }).click();

    await addEntity('Orders');
    await panel.getByRole('textbox', { name: 'Field name', exact: true }).fill('Status');
    await panel.getByRole('combobox', { name: 'Field type', exact: true }).selectOption('choice');
    await panel
        .getByRole('textbox', { name: 'Options, one per line', exact: true })
        .fill('Open\nShipped\n');
    await panel.getByRole('button', { name: 'Add field', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Field name', exact: true }).fill('Customer');
    await panel
        .getByRole('combobox', { name: 'Field type', exact: true })
        .selectOption('reference');
    await panel
        .getByRole('combobox', { name: 'Refers to', exact: true })
        .selectOption({ label: 'Customers' });
    await panel.getByRole('button', { name: 'Add field', exact: true }).click();
    await panel.getByRole('button', { name: 'Add record', exact: true }).click();

    const status = panel.getByRole('combobox', { name: 'Status, record 1', exact: true });
    await status.selectOption('Shipped');
    await panel.getByRole('button', { name: 'Save Status, record 1', exact: true }).click();
    const customer = panel.getByRole('combobox', { name: 'Customer, record 1', exact: true });
    await expect(customer.getByRole('option')).toHaveText(['Not set', 'Ada']);
    await customer.selectOption({ label: 'Ada' });
    await panel.getByRole('button', { name: 'Save Customer, record 1', exact: true }).click();
    await expect(panel.getByRole('region', { name: 'Data diagnostics' })).toHaveCount(0);

    // Removing the chosen option keeps the value and reports it.
    await panel
        .getByRole('textbox', { name: 'Options for Status', exact: true })
        .fill('Open\nSent');
    await panel.getByRole('button', { name: 'Save Options for Status', exact: true }).click();
    await expect(panel.getByRole('region', { name: 'Data diagnostics' })).toContainText(
        'Status must be one of its options.'
    );
    await expect(status).toHaveValue('Shipped');
    await expect(status.getByRole('option', { name: 'Shipped (unavailable)' })).toHaveCount(1);

    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await openEditor(page, ['Data View']);
    await panel
        .getByRole('combobox', { name: 'Entity', exact: true })
        .selectOption({ label: 'Orders' });
    await expect(customer.locator('option:checked')).toHaveText('Ada');
    await expect(
        panel.getByRole('combobox', { name: 'Customer refers to', exact: true })
    ).toHaveValue(/.+/);
});
