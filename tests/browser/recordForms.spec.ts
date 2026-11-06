import { expect, test } from '@playwright/test';
import { recordDetailFixture } from '../support/dataList';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

async function openFormEditor(page: import('@playwright/test').Page) {
    const { document } = recordDetailFixture();
    document.dataFields.age = {
        id: 'age',
        name: 'Age',
        entityId: 'customers',
        type: 'number',
        required: true
    };
    document.dataFields.active = {
        id: 'active',
        name: 'Active',
        entityId: 'customers',
        type: 'boolean',
        required: true
    };
    document.dataRecords.ada.values = { name: 'Ada', age: 36, active: true };
    document.dataRecords.grace.values = { name: 'Grace', age: 85, active: false };
    await page.addInitScript(
        (saved) => localStorage.setItem('reactor', saved),
        JSON.stringify(
            serializePersistedState({
                currentDocumentId: document.id,
                documents: { [document.id]: document }
            })
        )
    );
    await openEditor(page);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();

    return page.frameLocator('iframe[title="Application preview"]');
}

test('validates a record form, saves into list and detail, cancels drafts and resets sample values', async ({
    page
}, info) => {
    const preview = await openFormEditor(page);
    await expect(page.getByRole('button', { name: 'Edit record', exact: true })).toBeDisabled();
    await preview.getByRole('button', { name: 'Ada', exact: true }).click();
    await preview.getByRole('textbox', { name: 'Ada', exact: true }).fill('Unrelated input draft');
    await page.getByRole('button', { name: 'Edit record', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Edit Customers record' });
    await form.getByLabel('Name', { exact: false }).fill('');
    await form.getByLabel('Age', { exact: false }).fill('invalid');
    await form.getByLabel('Active', { exact: false }).selectOption('');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(form.getByText('Name is required.', { exact: true })).toBeVisible();
    await expect(form.getByText('Age must be number.', { exact: true })).toBeVisible();
    await expect(form.getByText('Active is required.', { exact: true })).toBeVisible();
    await form.getByLabel('Name', { exact: false }).fill('Countess');
    await form.getByLabel('Age', { exact: false }).fill('0');
    await form.getByLabel('Active', { exact: false }).selectOption('false');
    await page.screenshot({ path: info.outputPath('record-form.png') });
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(preview.getByRole('textbox', { name: 'Countess', exact: true })).toHaveValue(
        'Countess'
    );
    await page.getByRole('button', { name: 'Edit record', exact: true }).click();
    await expect(form.getByLabel('Age', { exact: false })).toHaveValue('0');
    await expect(form.getByLabel('Active', { exact: false })).toHaveValue('false');
    await form.getByLabel('Name', { exact: false }).fill('Discard me');
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(preview.getByRole('textbox', { name: 'Countess', exact: true })).toHaveValue(
        'Countess'
    );
    await preview.getByLabel('Preview screen').selectOption('home');
    await expect(preview.getByRole('button', { name: 'Countess', exact: true })).toBeVisible();
    await preview.getByRole('button', { name: 'Grace', exact: true }).click();
    await expect(preview.getByRole('textbox', { name: 'Grace', exact: true })).toHaveValue('Grace');
    await preview.getByRole('button', { name: 'Restart preview' }).click();
    await expect(preview.getByRole('button', { name: 'Ada', exact: true })).toBeVisible();
    await expect(preview.getByRole('button', { name: 'Countess', exact: true })).toHaveCount(0);
});

test('keeps saved form values out of a second player and the persisted document', async ({
    page,
    context
}) => {
    const preview = await openFormEditor(page);
    await preview.getByRole('button', { name: 'Ada', exact: true }).click();
    await page.getByRole('button', { name: 'Edit record', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Edit Customers record' });
    await form.getByLabel('Name', { exact: false }).fill('Private');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(preview.getByRole('textbox', { name: 'Private', exact: true })).toHaveValue(
        'Private'
    );
    const other = await context.newPage();
    await openEditor(other);
    await other.getByRole('button', { name: 'Preview', exact: true }).click();
    const second = other.frameLocator('iframe[title="Application preview"]');
    await expect(second.getByRole('button', { name: 'Ada', exact: true })).toBeVisible();
    await expect(second.getByRole('button', { name: 'Private', exact: true })).toHaveCount(0);
    await page.reload();
    await openEditor(page);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(preview.getByRole('button', { name: 'Ada', exact: true })).toBeVisible();
    await other.close();
});

test('supports the full Prototype header, narrow form layout, Escape and Restart', async ({
    page
}, info) => {
    await openFormEditor(page);
    await page.getByRole('link', { name: 'Open prototype' }).click();
    const preview = page.frameLocator('iframe[title="Application preview"]');
    await preview.getByRole('button', { name: 'Ada', exact: true }).click();
    await page.setViewportSize({ width: 600, height: 850 });
    const edit = page.getByRole('button', { name: 'Edit record', exact: true });
    await edit.click();
    const form = page.getByRole('dialog', { name: 'Edit Customers record' });
    await expect(form.getByLabel('Name', { exact: false })).toBeInViewport();
    await expect(form.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
    await form.getByLabel('Name', { exact: false }).fill('Player edit');
    await page.screenshot({ path: info.outputPath('record-form-narrow.png') });
    await form.press('Escape');
    await expect(edit).toBeFocused();
    await edit.click();
    await expect(form.getByLabel('Name', { exact: false })).toHaveValue('Ada');
    await form.getByLabel('Name', { exact: false }).fill('Player edit');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(preview.getByRole('textbox', { name: 'Player edit', exact: true })).toHaveValue(
        'Player edit'
    );
    await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
    await expect(preview.getByRole('button', { name: 'Ada', exact: true })).toBeVisible();
});

test('refuses a stale form after the record changes in another editor', async ({
    page,
    context
}) => {
    const preview = await openFormEditor(page);
    await preview.getByRole('button', { name: 'Ada', exact: true }).click();
    await page.getByRole('button', { name: 'Edit record', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Edit Customers record' });
    await form.getByLabel('Name', { exact: false }).fill('Stale draft');
    const other = await context.newPage();
    await openEditor(other, ['Data View']);
    const data = other.getByRole('region', { name: 'Data View', exact: true });
    await data.getByRole('textbox', { name: 'Name, record 1', exact: true }).fill('Remote update');
    await data.getByRole('button', { name: 'Save Name, record 1', exact: true }).click();
    await expect(form.getByRole('alert')).toContainText('This record or its fields changed');
    await expect(form.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Edit record', exact: true }).click();
    await expect(form.getByLabel('Name', { exact: false })).toHaveValue('Remote update');
    await other.close();
});

test('hides Edit record in a preview with no selected-record binding', async ({ page }) => {
    const { document, detail } = recordDetailFixture();
    delete detail.dataList;
    await page.addInitScript(
        (saved) => localStorage.setItem('reactor', saved),
        JSON.stringify(
            serializePersistedState({
                currentDocumentId: document.id,
                documents: { [document.id]: document }
            })
        )
    );
    await openEditor(page);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.frameLocator('iframe[title="Application preview"]');
    await expect(preview.getByRole('button', { name: 'Ada', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit record', exact: true })).toHaveCount(0);
});
