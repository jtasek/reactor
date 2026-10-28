import { expect, test, type Page } from '@playwright/test';
import { createDocument } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';
import {
    createVariable,
    deleteVariable,
    selectVariable,
    variablesPanel
} from './support/variables';

async function themedDocument(page: Page, locked = false) {
    const document = createDocument({
        id: 'panel-modes',
        locked,
        dimensions: {
            theme: {
                id: 'theme',
                name: 'Theme',
                order: 0,
                defaultModeId: 'light',
                modes: {
                    light: { id: 'light', name: 'Light', order: 0 },
                    dark: { id: 'dark', name: 'Dark', order: 1 }
                }
            }
        },
        variables: {
            ink: {
                id: 'ink',
                name: 'brand/ink',
                type: 'color',
                dimensionId: 'theme',
                values: { default: '#112233', dark: '#ddeeff' }
            }
        }
    });
    await page.addInitScript(
        (raw) => localStorage.setItem('reactor', raw),
        JSON.stringify(
            serializePersistedState({
                currentDocumentId: document.id,
                documents: { [document.id]: document }
            })
        )
    );
    await openEditor(page, ['Variables']);
    await page.getByRole('button', { name: 'More panels', exact: true }).click();
}

test('protects creation drafts and creates typed base values with the keyboard', async ({
    page
}) => {
    await openEditor(page, ['Variables']);
    const panel = variablesPanel(page);
    await panel
        .getByRole('button', { name: 'New variable', exact: true })
        .filter({ visible: true })
        .click();
    await panel.getByLabel('New variable name').fill('spacing/large');
    await panel.getByLabel('New variable type').selectOption('number');
    await panel.getByLabel('New variable value').fill('24');
    await panel.getByRole('button', { name: 'Dimensions', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('unfinished changes');
    await panel.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(panel.getByLabel('New variable value')).toHaveValue('24');
    await panel.getByLabel('New variable value').press('Enter');
    await expect(panel.getByLabel('Value of spacing/large', { exact: true })).toHaveValue('24');
    await createVariable(page, 'shown', 'Boolean');
    await expect(panel.getByText('Add mode values · Optional')).toHaveCount(0);
    await expect(panel.getByLabel('Value of shown')).not.toBeChecked();
});

test('preserves mode values on default changes and asks before removing overrides', async ({
    page
}) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
    await panel.getByLabel('Use Dark as default').check();
    await panel.getByRole('button', { name: 'Back to brand/ink', exact: true }).click();
    await panel.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click();
    await panel.getByRole('button', { name: 'Back to brand/ink', exact: true }).click();
    await expect(panel.getByLabel('Value of brand/ink', { exact: true })).toHaveValue('#ddeeff');
    await expect(panel.getByLabel('Light value of brand/ink', { exact: true })).toHaveValue(
        '#112233'
    );
    await panel.getByLabel('Dimension of brand/ink').selectOption('');
    await panel.getByRole('button', { name: 'Keep dimension', exact: true }).click();
    await expect(panel.getByLabel('Light value of brand/ink', { exact: true })).toHaveValue(
        '#112233'
    );
    await panel.getByLabel('Dimension of brand/ink').selectOption('');
    await panel.getByRole('button', { name: 'Change dimension', exact: true }).click();
    await expect(panel.getByLabel('Light value of brand/ink', { exact: true })).toHaveCount(0);
    await expect(panel.getByLabel('Value of brand/ink', { exact: true })).toHaveValue('#ddeeff');
});

test('keeps editing usable in wide and narrow panels', async ({ page }) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    await expect(
        panel.getByRole('button', { name: 'Edit variable brand/ink', exact: true })
    ).toBeVisible();
    await page.screenshot({ path: 'test-results/variables-panel-wide.png' });
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(panel.getByLabel('Selected variable')).toBeVisible();
    await panel.getByLabel('Dark hex value of brand/ink').fill('#abcdef');
    await panel.getByLabel('Dark hex value of brand/ink').press('Enter');
    await expect(panel.getByLabel('Dark value of brand/ink', { exact: true })).toHaveValue(
        '#abcdef'
    );
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
    );
    await page.screenshot({ path: 'test-results/variables-panel-narrow.png' });
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    await expect(panel.getByLabel('Name of dimension Theme')).toBeVisible();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
    );
    await page.screenshot({ path: 'test-results/dimensions-panel-narrow.png' });
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(panel.getByRole('button', { name: 'Edit dimension Theme' })).toBeVisible();
    await page.screenshot({ path: 'test-results/dimensions-panel-wide.png' });
});

test('locked documents keep browsing and preview available but prevent edits', async ({ page }) => {
    await themedDocument(page, true);
    const panel = variablesPanel(page);
    await selectVariable(page, 'brand/ink');
    await expect(panel.getByLabel('Name of brand/ink')).toBeDisabled();
    await expect(panel.getByLabel('Value of brand/ink', { exact: true })).toBeDisabled();
    await expect(
        panel.getByRole('button', { name: 'New variable', exact: true }).filter({ visible: true })
    ).toBeDisabled();
    await panel.getByRole('button', { name: 'Dimensions', exact: true }).click();
    await expect(panel.getByLabel('Name of dimension Theme')).toBeDisabled();
});

test('requires reloading a dimension changed in another tab before saving a stale draft', async ({
    page,
    context
}) => {
    await themedDocument(page);
    await expect(page.locator('#status-save')).toHaveText('Saved');
    const panel = variablesPanel(page);
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    await panel.getByLabel('Name of dimension Theme').fill('Personal theme');
    const peer = await context.newPage();
    await openEditor(peer, ['Variables']);
    await peer.getByRole('button', { name: 'More panels', exact: true }).click();
    const other = variablesPanel(peer);
    await other.getByRole('button', { name: 'Dimensions', exact: true }).click();
    await other.getByLabel('Name of dimension Theme').fill('Shared theme');
    await other.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('changed elsewhere');
    await expect(panel.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
    await panel.getByRole('button', { name: 'Reload dimension', exact: true }).click();
    await expect(panel.getByLabel('Name of dimension Shared theme')).toHaveValue('Shared theme');
    await peer.close();
});

test('accepts negative decimal numbers typed one character at a time', async ({ page }) => {
    await openEditor(page, ['Variables']);
    const panel = variablesPanel(page);
    await panel
        .getByRole('button', { name: 'New variable', exact: true })
        .filter({ visible: true })
        .click();
    await panel.getByLabel('New variable name').fill('offset');
    await panel.getByLabel('New variable type').selectOption('number');
    const value = panel.getByLabel('New variable value');
    await value.fill('');
    await value.pressSequentially('-12.5');
    await expect(value).toHaveValue('-12.5');
    await panel.getByRole('button', { name: 'Create variable', exact: true }).click();
    await expect(panel.getByLabel('Value of offset', { exact: true })).toHaveValue('-12.5');
});

test('removes an unsaved default mode without discarding other dimension edits', async ({
    page
}) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    await panel.getByLabel('Name of dimension Theme').fill('Appearance');
    await panel.getByRole('button', { name: 'Add mode', exact: true }).click();
    await panel.getByPlaceholder('Mode name').last().fill('Temporary');
    await panel.getByLabel('Use Temporary as default').check();
    await panel.getByLabel('Actions for mode Temporary', { exact: true }).click();
    await panel.getByRole('button', { name: 'Remove unsaved mode Temporary', exact: true }).click();
    await expect(panel.getByLabel('Use Light as default')).toBeChecked();
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(panel.getByLabel('Name of dimension Appearance')).toHaveValue('Appearance');
    await expect(panel.getByLabel('Use Temporary as default')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Back to brand/ink', exact: true }).click();
    await expect(panel.getByLabel('Dark value of brand/ink', { exact: true })).toHaveValue(
        '#ddeeff'
    );
});

test('detects a remote default-mode change even without any variable values changing', async ({
    page,
    context
}) => {
    await themedDocument(page);
    await deleteVariable(page, 'brand/ink');
    await expect(page.locator('#status-save')).toHaveText('Saved');
    const panel = variablesPanel(page);
    await panel.getByRole('button', { name: 'Dimensions', exact: true }).click();
    await panel.getByLabel('Name of dimension Theme').fill('Personal theme');
    const peer = await context.newPage();
    await openEditor(peer, ['Variables']);
    await peer.getByRole('button', { name: 'More panels', exact: true }).click();
    const other = variablesPanel(peer);
    await other.getByRole('button', { name: 'Dimensions', exact: true }).click();
    await other.getByLabel('Use Dark as default').check();
    await other.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('changed elsewhere');
    await expect(panel.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
    await panel.getByRole('button', { name: 'Reload dimension', exact: true }).click();
    await expect(panel.getByLabel('Use Dark as default')).toBeChecked();
    await peer.close();
});

test('dismisses a pending mode deletion when new dimension edits begin', async ({ page }) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    await panel.getByLabel('Actions for mode Dark', { exact: true }).click();
    await panel.getByRole('button', { name: 'Delete mode Dark', exact: true }).click();
    await expect(panel.getByRole('group', { name: 'Confirm deletion' })).toBeVisible();
    await panel.getByLabel('Name of dimension Theme').fill('Appearance');
    await expect(panel.getByRole('group', { name: 'Confirm deletion' })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(panel.getByLabel('Name of dimension Appearance')).toHaveValue('Appearance');
    await expect(panel.getByLabel('Use Dark as default')).toBeVisible();
});

test('keeps the initial variable selected when renaming changes its sort position', async ({
    page
}) => {
    await openEditor(page, ['Variables']);
    await createVariable(page, 'Alpha');
    await createVariable(page, 'Middle');
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await openEditor(page, ['Variables']);
    const panel = variablesPanel(page);
    await panel.getByLabel('Name of Alpha').fill('Zulu');
    await panel.getByLabel('Name of Alpha').press('Enter');
    await expect(panel.getByLabel('Name of Zulu')).toHaveValue('Zulu');
    await expect(panel.getByRole('button', { name: 'Edit variable Zulu' })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
});

test('says when the dimension being edited is deleted in another tab and clears the draft', async ({
    page,
    context
}) => {
    await themedDocument(page);
    await expect(page.locator('#status-save')).toHaveText('Saved');
    const panel = variablesPanel(page);
    await panel.getByRole('button', { name: 'Dimensions', exact: true }).click();
    await panel.getByLabel('Name of dimension Theme').fill('Personal theme');
    const peer = await context.newPage();
    await openEditor(peer, ['Variables']);
    await peer.getByRole('button', { name: 'More panels', exact: true }).click();
    const other = variablesPanel(peer);
    await other.getByRole('button', { name: 'Dimensions', exact: true }).click();
    await other.getByText('Dimension actions', { exact: true }).click();
    await other.getByRole('button', { name: 'Delete dimension', exact: true }).click();
    await other.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(panel.getByRole('heading', { name: 'No dimensions yet' })).toBeVisible();
    await expect(panel.getByRole('status')).toContainText('deleted elsewhere');
    await panel.getByRole('button', { name: 'Variables', exact: true }).click();
    await expect(panel.getByText('You have unfinished changes.')).toHaveCount(0);
    await expect(panel.getByRole('status')).toHaveCount(0);
    await expect(panel.getByLabel('Name of brand/ink', { exact: true })).toBeVisible();
    await peer.close();
});

test('offers the way back to a variable only after Manage modes', async ({ page }) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    const back = panel.getByRole('button', { name: 'Back to brand/ink', exact: true });
    await expect(back).toBeVisible();
    await back.click();
    await panel.getByRole('button', { name: 'Dimensions', exact: true }).click();
    await expect(panel.getByLabel('Name of dimension Theme')).toBeVisible();
    await expect(back).toHaveCount(0);
});
