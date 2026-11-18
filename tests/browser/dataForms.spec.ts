import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { recordDetailFixture } from '../support/dataList';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

test('authors typed data, preserves values when fields change, reloads and undoes', async ({
    page
}, testInfo) => {
    await openEditor(page, ['Data']);
    const panel = page.getByRole('region', { name: 'Data', exact: true });
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
    await openEditor(page, ['Data']);
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
    await openEditor(page, ['Data']);
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
    await openEditor(page, ['Data']);
    const panel = page.getByRole('region', { name: 'Data', exact: true });
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
    await openEditor(page, ['Data']);
    await panel
        .getByRole('combobox', { name: 'Entity', exact: true })
        .selectOption({ label: 'Orders' });
    await expect(customer.locator('option:checked')).toHaveText('Ada');
    await expect(
        panel.getByRole('combobox', { name: 'Customer refers to', exact: true })
    ).toHaveValue(/.+/);
});

test('authors rules with conditions, lists records that break them, edits and deletes them', async ({
    page
}, info) => {
    await openEditor(page, ['Data']);
    const panel = page.getByRole('region', { name: 'Data', exact: true });
    await panel.getByRole('textbox', { name: 'New entity', exact: true }).fill('Customers');
    await panel.getByRole('button', { name: 'Add entity', exact: true }).click();
    for (const [name, type] of [
        ['Name', 'text'],
        ['Age', 'number']
    ]) {
        await panel.getByRole('textbox', { name: 'Field name', exact: true }).fill(name);
        await panel.getByRole('combobox', { name: 'Field type', exact: true }).selectOption(type);
        await panel.getByRole('button', { name: 'Add field', exact: true }).click();
    }
    await panel.getByRole('button', { name: 'Add record', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Age, record 1', exact: true }).fill('12');
    await panel.getByRole('button', { name: 'Save Age, record 1', exact: true }).click();

    const rules = panel.getByRole('region', { name: 'Rules', exact: true });
    await rules.getByRole('button', { name: 'Add rule', exact: true }).click();
    const form = rules.getByRole('form', { name: 'New rule' });
    const check = 'Records must have, condition 1';
    await form.getByRole('combobox', { name: `${check}: field` }).selectOption({ label: 'Age' });
    await form
        .getByRole('combobox', { name: `${check}: comparison` })
        .selectOption({ label: 'is greater than' });
    await form.getByRole('textbox', { name: `${check}: value` }).fill('17');
    await form.getByRole('checkbox', { name: 'Only when…' }).check();
    await form
        .getByRole('combobox', { name: 'Only when, condition 1: field' })
        .selectOption({ label: 'Age' });
    await form
        .getByRole('textbox', { name: 'Message', exact: true })
        .fill('Customers must be adults.');
    await form
        .getByRole('combobox', { name: 'Show message at', exact: true })
        .selectOption({ label: 'Age' });
    await page.screenshot({ path: info.outputPath('rule-form.png') });
    await form.getByRole('button', { name: 'Add rule', exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(rules).toContainText('When Age is set: Age is greater than “17” · Shown at Age');
    await expect(panel.getByRole('region', { name: 'Data diagnostics' })).toContainText(
        'Customers record 1: Customers must be adults.'
    );
    await expect(panel.getByRole('cell', { name: /Customers must be adults\./ })).toBeVisible();
    await page.screenshot({ path: info.outputPath('rules.png'), fullPage: true });

    await rules
        .getByRole('button', { name: 'Edit rule “Customers must be adults.”', exact: true })
        .click();
    const edit = rules.getByRole('form', { name: 'Edit rule Customers must be adults.' });
    await expect(edit.getByRole('textbox', { name: `${check}: value` })).toHaveValue('17');
    await edit.getByRole('textbox', { name: `${check}: value` }).fill('10');
    await edit.getByRole('button', { name: 'Save rule', exact: true }).click();
    await expect(panel.getByRole('region', { name: 'Data diagnostics' })).toHaveCount(0);

    await rules
        .getByRole('button', { name: 'Delete rule “Customers must be adults.”', exact: true })
        .click();
    await expect(rules).toContainText('No rules yet.');
    await page
        .getByRole('list', { name: 'Commands' })
        .getByRole('button', { name: 'Undo', exact: true })
        .click();
    await expect(rules).toContainText('Age is greater than “10”');
    await panel.getByRole('button', { name: 'Delete Age…', exact: true }).click();
    await expect(panel.getByRole('alert').filter({ hasText: 'Delete this field' })).toContainText(
        'A rule uses this field. It stops checking records until edited.'
    );
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await openEditor(page, ['Data']);
    await expect(rules).toContainText('Age is greater than “10”');
});

test('the downloaded package plays list and details offline, as the preview does', async ({
    page,
    browser
}, info) => {
    const { document } = recordDetailFixture();
    document.name = 'Customers </script> app';
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await page.goto('/prototype');
    const player = page.frameLocator('iframe[title="Application preview"]');
    await expect(player.getByRole('button', { name: 'Ada', exact: true })).toBeVisible();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download prototype' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('Customers --script- app.html');
    const file = info.outputPath('package.html');
    await download.saveAs(file);
    expect(await readFile(file, 'utf8')).not.toContain('Customers </script>');

    const offline = await browser.newContext({ offline: true });
    const requests: string[] = [];
    offline.on('request', (request) => requests.push(request.url()));
    const played = await offline.newPage();
    const errors: string[] = [];
    played.on('console', (message) => {
        if (message.type() === 'error') {
            errors.push(message.text());
        }
    });
    await played.goto(`file://${file}`);
    await expect(played).toHaveTitle('Customers </script> app');
    await played.getByRole('button', { name: 'Ada', exact: true }).click();
    await expect(played.getByLabel('Preview page')).toHaveValue('details');
    await played.getByRole('textbox', { name: 'Ada', exact: true }).fill('Edited Ada');
    await played.getByLabel('Preview page').selectOption('home');
    await played.getByRole('button', { name: 'Grace', exact: true }).click();
    await expect(played.getByRole('textbox', { name: 'Grace', exact: true })).toHaveValue('Grace');
    await played.getByLabel('Preview page').selectOption('home');
    await played.getByRole('button', { name: 'Ada', exact: true }).click();
    await expect(played.getByRole('textbox', { name: 'Ada', exact: true })).toHaveValue(
        'Edited Ada'
    );
    await played.getByRole('button', { name: 'Restart prototype' }).click();
    await expect(played.getByLabel('Preview page')).toHaveValue('home');
    await played.getByLabel('Preview page').selectOption('details');
    await expect(played.getByRole('textbox', { name: 'Your name', exact: true })).toHaveValue(
        'Your name'
    );
    // The drawing font comes from the page itself.
    expect(
        await played.evaluate(async () => {
            await window.document.fonts.ready;

            return [...window.document.fonts].some(
                (font) => font.family.includes('Roboto') && font.status === 'loaded'
            );
        })
    ).toBe(true);
    await played.screenshot({ path: info.outputPath('package-offline.png') });
    expect(requests.filter((url) => !url.startsWith('file:') && !url.startsWith('data:'))).toEqual(
        []
    );
    expect(errors).toEqual([]);
    await offline.close();
});
