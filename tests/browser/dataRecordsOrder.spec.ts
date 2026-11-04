import { expect, test } from '@playwright/test';
import { openEditor } from './support/editor';

test('keeps records in added order and confirms deletes beside the button', async ({ page }) => {
    await openEditor(page, ['Data View']);
    const panel = page.getByRole('region', { name: 'Data View', exact: true });
    await panel.getByRole('textbox', { name: 'New entity', exact: true }).fill('Customers');
    await panel.getByRole('button', { name: 'Add entity', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Field name', exact: true }).fill('Name');
    await panel.getByRole('button', { name: 'Add field', exact: true }).click();
    const names = ['Ada', 'Bob', 'Cy', 'Dee', 'Eve', 'Fay'];
    for (const [index, name] of names.entries()) {
        await panel.getByRole('button', { name: 'Add record', exact: true }).click();
        const label = `Name, record ${index + 1}`;
        await expect(panel.getByRole('textbox', { name: label, exact: true })).toHaveValue('');
        await panel.getByRole('textbox', { name: label, exact: true }).fill(name);
        await panel.getByRole('button', { name: `Save ${label}`, exact: true }).click();
    }
    for (const [index, name] of names.entries()) {
        await expect(
            panel.getByRole('textbox', { name: `Name, record ${index + 1}`, exact: true })
        ).toHaveValue(name);
    }

    await panel.getByRole('button', { name: 'Delete Name…', exact: true }).click();
    const cancel = panel.getByRole('button', { name: 'Cancel', exact: true });
    await expect(cancel).toBeFocused();
    await expect(panel.getByRole('button', { name: 'Delete', exact: true })).toBeInViewport();
    await cancel.click();

    await panel.getByRole('button', { name: 'Delete entity…', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Delete', exact: true })).toBeInViewport();
    await panel.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(panel.getByText('No entities yet.')).toBeVisible();
});
