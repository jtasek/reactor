import { expect, test, type Page } from '@playwright/test';
import { createDocument } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';
import {
    createVariable,
    deleteVariable,
    selectVariable,
    resetModeValue,
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
    await panel.getByRole('tab', { name: 'Dimensions', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('unfinished changes');
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(panel.getByLabel('New variable value')).toHaveValue('24');
    await panel.getByLabel('New variable value').press('Enter');
    await expect(panel.getByLabel('Value of spacing/large', { exact: true })).toHaveValue('24');
    await createVariable(page, 'shown', 'Boolean');
    await expect(
        panel.getByRole('button', { name: 'Add different values…', exact: true })
    ).toHaveCount(0);
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
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click();
    await panel.getByRole('button', { name: 'Back to brand/ink', exact: true }).click();
    await expect(panel.getByLabel('Value of brand/ink', { exact: true })).toHaveValue('#ddeeff');
    await expect(panel.getByLabel('Light value of brand/ink', { exact: true })).toHaveValue(
        '#112233'
    );
    await panel.getByLabel('Dimension of brand/ink').selectOption('');
    await page.getByRole('button', { name: 'Keep dimension', exact: true }).click();
    await expect(panel.getByLabel('Light value of brand/ink', { exact: true })).toHaveValue(
        '#112233'
    );
    await panel.getByLabel('Dimension of brand/ink').selectOption('');
    await page.getByRole('button', { name: 'Change dimension', exact: true }).click();
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
    await expect(panel.getByRole('tab', { name: 'Variables', exact: true })).toBeInViewport();
    await expect(panel.getByRole('button', { name: 'New variable', exact: true })).toBeInViewport();
    await page.screenshot({ path: 'test-results/variables-panel-narrow.png' });
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    await expect(panel.getByLabel('Name of dimension Theme')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Save changes', exact: true })).toBeInViewport();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
    );
    await page.screenshot({ path: 'test-results/dimensions-panel-narrow.png' });
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(panel.getByRole('button', { name: 'Edit dimension Theme' })).toBeVisible();
    await page.screenshot({ path: 'test-results/dimensions-panel-wide.png' });
});

test('uses keyboard tabs without bypassing unfinished dimension or creation drafts', async ({
    page
}) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    const variables = panel.getByRole('tab', { name: 'Variables', exact: true });
    const dimensions = panel.getByRole('tab', { name: 'Dimensions', exact: true });
    await variables.focus();
    await page.keyboard.press('ArrowRight');
    await expect(dimensions).toBeFocused();
    await expect(variables).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(panel.getByRole('tabpanel', { name: 'Dimensions', exact: true })).toBeVisible();
    await page.keyboard.press('Home');
    await expect(variables).toBeFocused();
    await page.keyboard.press('Space');
    await expect(variables).toHaveAttribute('aria-selected', 'true');
    await panel.getByRole('button', { name: 'New variable', exact: true }).click();
    await panel.getByLabel('New variable name').fill('Unfinished');
    await dimensions.click();
    await expect(page.getByRole('dialog', { name: 'Discard unfinished changes?' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel.getByLabel('New variable name')).toHaveValue('Unfinished');
    await expect(variables).toHaveAttribute('aria-selected', 'true');
    await dimensions.click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(dimensions).toHaveAttribute('aria-selected', 'true');
});

test('opens utilities without shifting the workspace and restores focus after dismissal', async ({
    page
}) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    const name = panel.getByLabel('Name of brand/ink', { exact: true });
    const bounds = await name.boundingBox();
    const preview = panel.getByRole('button', { name: 'Preview modes', exact: true });
    await preview.click();
    const popover = page.getByRole('dialog', { name: 'Canvas preview', exact: true });
    await expect(popover).toBeVisible();
    expect(await popover.evaluate((element) => element.matches(':popover-open'))).toBe(true);
    expect(await name.boundingBox()).toEqual(bounds);
    await page.getByLabel('Preview Theme', { exact: true }).selectOption('dark');
    await page.screenshot({ path: 'test-results/variables-preview-popover.png' });
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(preview).toBeFocused();
    for (const action of ['Import', 'Export']) {
        const trigger = panel.getByRole('button', { name: action, exact: true });
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: `${action} design system`, exact: true });
        await expect(dialog).toBeVisible();
        expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
        expect(await name.boundingBox()).toEqual(bounds);
        await page.keyboard.press('Tab');
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
            true
        );
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
    }
    await expect(panel.getByLabel('Dimension of brand/ink', { exact: true })).toBeVisible();
    await expect(panel.locator('details')).toHaveCount(0);
});

test('keeps an open mode preview inside the viewport when another tab adds dimensions', async ({
    page,
    context
}) => {
    await themedDocument(page);
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await variablesPanel(page).getByRole('button', { name: 'Preview modes', exact: true }).click();
    const popover = page.getByRole('dialog', { name: 'Canvas preview', exact: true });
    await expect(popover).toBeVisible();
    const peer = await context.newPage();
    await openEditor(peer, ['Variables']);
    await peer.getByRole('button', { name: 'More panels', exact: true }).click();
    const other = variablesPanel(peer);
    await other.getByRole('tab', { name: 'Dimensions', exact: true }).click();

    for (let index = 1; index <= 6; index++) {
        await other.getByRole('button', { name: 'New dimension', exact: true }).click();
        await other.getByLabel('New dimension name', { exact: true }).fill(`Brand ${index}`);
        await other.getByRole('button', { name: 'Create dimension', exact: true }).click();
    }

    await expect(popover.getByLabel('Preview Brand 6', { exact: true })).toHaveCount(1);
    await expect
        .poll(() => popover.evaluate((element) => element.getBoundingClientRect().bottom))
        .toBeLessThanOrEqual(page.viewportSize()!.height - 8);
    await expect(
        popover.getByRole('button', { name: 'Close preview', exact: true })
    ).toBeInViewport();
    await peer.close();
});

test('locked documents keep browsing and preview available but prevent edits', async ({ page }) => {
    await themedDocument(page, true);
    const panel = variablesPanel(page);
    await selectVariable(page, 'brand/ink');
    await expect(panel.getByLabel('Name of brand/ink')).toBeDisabled();
    await expect(panel.getByLabel('Value of brand/ink', { exact: true })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    await expect(
        panel.getByRole('button', { name: 'New variable', exact: true }).filter({ visible: true })
    ).toBeDisabled();
    await panel.getByRole('tab', { name: 'Dimensions', exact: true }).click();
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
    await other.getByRole('tab', { name: 'Dimensions', exact: true }).click();
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
    await panel.getByRole('tab', { name: 'Dimensions', exact: true }).click();
    await panel.getByLabel('Name of dimension Theme').fill('Personal theme');
    const peer = await context.newPage();
    await openEditor(peer, ['Variables']);
    await peer.getByRole('button', { name: 'More panels', exact: true }).click();
    const other = variablesPanel(peer);
    await other.getByRole('tab', { name: 'Dimensions', exact: true }).click();
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
    await panel.getByRole('tab', { name: 'Dimensions', exact: true }).click();
    await panel.getByLabel('Name of dimension Theme').fill('Personal theme');
    const peer = await context.newPage();
    await openEditor(peer, ['Variables']);
    await peer.getByRole('button', { name: 'More panels', exact: true }).click();
    const other = variablesPanel(peer);
    await other.getByRole('tab', { name: 'Dimensions', exact: true }).click();
    await other.getByRole('button', { name: 'Dimension actions', exact: true }).click();
    await other.getByRole('button', { name: 'Delete dimension', exact: true }).click();
    await other.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(panel.getByRole('heading', { name: 'No dimensions yet' })).toBeVisible();
    await expect(panel.getByRole('status')).toContainText('deleted elsewhere');
    await panel.getByRole('tab', { name: 'Variables', exact: true }).click();
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
    await panel.getByRole('tab', { name: 'Dimensions', exact: true }).click();
    await expect(panel.getByLabel('Name of dimension Theme')).toBeVisible();
    await expect(back).toHaveCount(0);
});

test('keeps creation in one place and opens actions without shifting the fields', async ({
    page
}) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    await expect(panel.getByRole('button', { name: 'New variable', exact: true })).toHaveCount(1);
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    const field = panel.getByLabel('Name of mode Dark in Theme');
    const before = await field.boundingBox();
    const trigger = panel.getByRole('button', { name: 'Actions for mode Dark', exact: true });
    await trigger.click();
    await expect(
        panel
            .getByRole('group', { name: 'Actions for mode Dark menu', exact: true })
            .getByRole('button', { name: 'Move up', exact: true })
    ).toBeVisible();
    expect(await field.boundingBox()).toEqual(before);
    await page.screenshot({ path: 'test-results/variables-action-menu.png' });
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await panel.getByLabel('Name of dimension Theme').click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(panel.getByRole('button', { name: 'New dimension', exact: true })).toHaveCount(1);
    await trigger.click();
    const menu = panel.getByRole('group', { name: 'Actions for mode Dark menu', exact: true });
    await expect(menu).toBeVisible();
    const bounds = await menu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: 'test-results/variables-action-menu-narrow.png' });
});

test('keeps all toolbar labels readable when docked at the standard panel width', async ({
    page
}) => {
    await themedDocument(page);
    const frame = page.locator('[data-panel="variables"]');
    const header = frame.locator(':scope > button').first();
    await header.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.locator('[data-dock="right"] [data-panel="variables"]')).toBeVisible();
    const panel = variablesPanel(page);
    for (const name of ['New variable', 'Preview modes', 'Import', 'Export']) {
        const button = panel.getByRole('button', { name, exact: true });
        await expect(button).toBeVisible();
        expect(await button.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
            true
        );
    }
    await panel.getByRole('button', { name: 'New variable', exact: true }).click();
    await expect(panel.getByLabel('New variable name')).toBeVisible();
    await page.screenshot({ path: 'test-results/variables-docked.png' });
});

test('dismisses an open menu when the viewport changes instead of leaving it offscreen', async ({
    page
}) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    const trigger = panel.getByRole('button', { name: 'Actions for brand/ink', exact: true });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    const bounds = await panel
        .getByRole('group', { name: 'Actions for brand/ink menu', exact: true })
        .boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});

test('closes an open menu when the panel scrolls so it never sits beside another row', async ({
    page
}) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    await themedDocument(page);
    const panel = variablesPanel(page);
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    for (let index = 0; index < 6; index++) {
        await panel.getByRole('button', { name: 'Add mode', exact: true }).click();
    }
    const trigger = panel.getByRole('button', { name: 'Actions for mode Dark', exact: true });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await trigger.hover();
    await page.mouse.wheel(0, 200);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(
        panel.getByRole('group', { name: 'Actions for mode Dark menu', exact: true })
    ).toBeHidden();
});

test('keeps keyboard focus in the panel after deleting from an action menu', async ({ page }) => {
    await openEditor(page, ['Variables']);
    await createVariable(page, 'first');
    await createVariable(page, 'second');
    const panel = variablesPanel(page);
    const trigger = panel.getByRole('button', { name: 'Actions for second', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const remove = panel
        .getByRole('group', { name: 'Actions for second menu', exact: true })
        .getByRole('button', { name: 'Delete variable', exact: true });
    await expect(remove).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panel.getByLabel('Name of second')).toHaveCount(0);
    await expect
        .poll(() =>
            page.evaluate(() =>
                Boolean(document.activeElement?.closest('[aria-label="Variables"]'))
            )
        )
        .toBe(true);
});

test('shows a named default row and edits inherited colors without an override step', async ({
    page
}) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    const values = panel.getByRole('region', { name: 'Values for Theme', exact: true });
    await expect(values.getByRole('group', { name: 'Light (default)', exact: true })).toBeVisible();
    await expect(panel.getByText('Base value', { exact: true })).toHaveCount(0);
    await expect(panel.getByLabel('Dimension of brand/ink')).toBeVisible();
    await resetModeValue(page, 'brand/ink', 'Dark', 'Light');
    const dark = panel.getByLabel('Dark value of brand/ink', { exact: true });
    await expect(dark).toBeFocused();
    await expect(values.getByText('Uses Light value', { exact: true })).toBeVisible();
    await panel.getByLabel('Hex value of brand/ink', { exact: true }).fill('#223344');
    await panel.getByLabel('Hex value of brand/ink', { exact: true }).press('Enter');
    await expect(dark).toHaveValue('#223344');
    const darkHex = panel.getByLabel('Dark hex value of brand/ink', { exact: true });
    await darkHex.fill('#556677');
    await darkHex.press('Enter');
    await expect(dark).toHaveValue('#556677');
    await expect(values.getByText('Uses Light value', { exact: true })).toHaveCount(0);
    await expect(panel.getByLabel('Value of brand/ink', { exact: true })).toHaveValue('#223344');
    await resetModeValue(page, 'brand/ink', 'Dark', 'Light');
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await openEditor(page, ['Variables']);
    await selectVariable(page, 'brand/ink');
    await expect(dark).toHaveValue('#223344');
    await expect(values.getByText('Uses Light value', { exact: true })).toBeVisible();
});

for (const [type, name, original, changed] of [
    ['Number', 'spacing', '8', '-12.5'],
    ['Text', 'greeting', 'Hello', 'Good morning']
]) {
    test(`edits and resets inherited ${type.toLowerCase()} values directly`, async ({ page }) => {
        await themedDocument(page);
        await createVariable(page, name, type);
        const panel = variablesPanel(page);
        const base = panel.getByLabel(`Value of ${name}`, { exact: true });
        await base.fill(original);
        await base.press('Enter');
        await panel.getByLabel(`Dimension of ${name}`, { exact: true }).selectOption('theme');
        const dark = panel.getByLabel(`Dark value of ${name}`, { exact: true });
        await expect(dark).toHaveValue(original);
        await dark.fill(changed);
        await dark.press('Escape');
        await expect(dark).toHaveValue(original);
        await expect(panel.getByText('Uses Light value', { exact: true })).toBeVisible();
        await dark.fill(changed);
        await dark.press('Enter');
        await expect(dark).toHaveValue(changed);
        await expect(base).toHaveValue(original);
        await resetModeValue(page, name, 'Dark', 'Light');
        await expect(dark).toBeFocused();
        await expect(dark).toHaveValue(original);
        await expect(page.locator('#status-save')).toHaveText('Saved');
        await page.reload();
        await openEditor(page, ['Variables']);
        await selectVariable(page, name);
        await expect(dark).toHaveValue(original);
        await expect(panel.getByText('Uses Light value', { exact: true })).toBeVisible();
    });
}

for (const [type, original, changed] of [
    ['Color', '#112233', '#445566'],
    ['Number', '8', '16'],
    ['Text', 'Hello', 'Good morning']
]) {
    test(`keeps an explicitly entered ${type.toLowerCase()} mode value independent of the default`, async ({
        page
    }) => {
        await themedDocument(page);
        await createVariable(page, 'independent', type);
        const panel = variablesPanel(page);
        const baseLabel = type === 'Color' ? 'Hex value' : 'Value';
        const modeLabel = type === 'Color' ? 'hex value' : 'value';
        const base = panel.getByLabel(`${baseLabel} of independent`, { exact: true });
        await base.fill(original);
        await base.press('Enter');
        await panel.getByLabel('Dimension of independent', { exact: true }).selectOption('theme');
        const dark = panel.getByLabel(`Dark ${modeLabel} of independent`, { exact: true });
        // Merely focusing and leaving the row must keep inheritance.
        await dark.focus();
        await base.focus();
        await expect(panel.getByText('Uses Light value', { exact: true })).toBeVisible();
        // Re-entering the same value is an explicit choice, unlike leaving it untouched.
        await dark.fill(changed);
        await dark.fill(original);
        await dark.press('Enter');
        await expect(panel.getByText('Uses Light value', { exact: true })).toHaveCount(0);
        await base.fill(changed);
        await base.press('Enter');
        await expect(dark).toHaveValue(original);
        await resetModeValue(page, 'independent', 'Dark', 'Light');
        await expect(dark).toHaveValue(changed);
        await expect(panel.getByText('Uses Light value', { exact: true })).toBeVisible();
    });
}

test('adds a first dimension from a variable and returns to its named values', async ({ page }) => {
    await openEditor(page, ['Variables']);
    await createVariable(page, 'primaryColor');
    const panel = variablesPanel(page);
    await panel.getByLabel('Value of primaryColor', { exact: true }).fill('#3366ff');
    await panel.getByRole('button', { name: 'New dimension…', exact: true }).click();
    await panel.getByLabel('New dimension name', { exact: true }).fill('Theme');
    await panel.getByLabel('Name of mode Default in new dimension').fill('Light');
    await panel.getByRole('button', { name: 'Add mode', exact: true }).click();
    await panel.getByPlaceholder('Mode name').last().fill('Dark');
    await panel.getByRole('button', { name: 'Create dimension', exact: true }).click();
    await expect(panel.getByRole('region', { name: 'Values for Theme' })).toBeVisible();
    await expect(panel.getByLabel('Value of primaryColor', { exact: true })).toHaveValue('#3366ff');
    await expect(panel.getByLabel('Dark value of primaryColor', { exact: true })).toHaveValue(
        '#3366ff'
    );
    await expect(panel.getByText('Uses Light value', { exact: true })).toBeVisible();
});

test('leaves Escape alone on a closed action menu button', async ({ page }) => {
    await themedDocument(page);
    const trigger = variablesPanel(page).getByRole('button', {
        name: 'Actions for brand/ink',
        exact: true
    });
    const reached = await trigger.evaluate((element) => {
        let heard = false;
        const listen = () => {
            heard = true;
        };
        document.addEventListener('keydown', listen);
        element.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
        );
        document.removeEventListener('keydown', listen);

        return heard;
    });
    expect(reached).toBe(true);
});

test('assigns a new dimension only to the variable that asked for it', async ({ page }) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    await selectVariable(page, 'brand/ink');
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    await panel.getByRole('button', { name: 'Dimension actions', exact: true }).click();
    await panel.getByRole('button', { name: 'Delete dimension', exact: true }).click();
    await page
        .getByRole('group', { name: 'Confirm deletion' })
        .getByRole('button', { name: 'Delete', exact: true })
        .click();
    // brand/ink is unbound now, but this dimension is started from the Dimensions tab.
    await panel
        .getByRole('button', { name: 'New dimension', exact: true })
        .filter({ visible: true })
        .click();
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(panel.getByRole('tab', { name: 'Dimensions', exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
    );
    await panel
        .getByRole('button', { name: 'New dimension', exact: true })
        .filter({ visible: true })
        .click();
    await page.getByLabel('New dimension name', { exact: true }).fill('Size');
    await panel.getByRole('button', { name: 'Create dimension', exact: true }).click();
    await expect(panel.getByRole('tab', { name: 'Dimensions', exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
    );
    await selectVariable(page, 'brand/ink');
    await expect(panel.getByRole('region', { name: 'Values for Size', exact: true })).toHaveCount(
        0
    );
    await expect(panel.getByLabel('Value of brand/ink', { exact: true })).toBeVisible();
});

test('names the default mode on its row and hides empty boolean settings', async ({ page }) => {
    await themedDocument(page);
    const panel = variablesPanel(page);
    await expect(
        panel.getByLabel('Value of brand/ink', { exact: true })
    ).toHaveAccessibleDescription('Light Default');
    await createVariable(page, 'shown', 'Boolean');
    await panel.getByRole('button', { name: 'Actions for shown', exact: true }).click();
    await expect(
        panel
            .getByRole('group', { name: 'Actions for shown menu', exact: true })
            .getByRole('button', { name: 'Delete variable', exact: true })
    ).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Variable settings', exact: true })).toHaveCount(
        0
    );
    await page.keyboard.press('Escape');
    await createVariable(page, 'visible', 'Boolean');
    await expect(panel.getByLabel('Source of visible', { exact: true })).toBeVisible();
});
