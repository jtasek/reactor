import {
    createVariable,
    selectVariable,
    openModePreview,
    resetModeValue,
    variablesPanel
} from './support/variables';
import { createDocument } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { expect, test } from '@playwright/test';
import { drawRect, openEditor, shapes, pointer } from './support/editor';

test('dimensions are opt-in and custom modes preserve colors, bounds and local selection through rename and reload', async ({
    page
}) => {
    await openEditor(page, ['Inspector', 'Variables']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await createVariable(page, 'Ink');
    await expect(page.getByLabel('Dimension of Ink', { exact: true })).toHaveValue('');
    await page.getByLabel('Value of Ink', { exact: true }).fill('#112233');
    await page.getByLabel('Variable for Fill', { exact: true }).selectOption({ label: 'Ink' });
    const rect = shapes(page).first().locator('rect[data-cy]');
    const fill = () => rect.evaluate((element) => getComputedStyle(element).fill);
    await expect.poll(fill).toBe('rgb(17, 34, 51)');
    const bounds = await rect.boundingBox();
    const panel = variablesPanel(page);
    await panel.getByRole('tab', { name: 'Dimensions', exact: true }).click();
    await panel
        .getByRole('button', { name: 'New dimension', exact: true })
        .filter({ visible: true })
        .click();
    await page.getByLabel('New dimension name', { exact: true }).fill('Appearance');
    await panel.getByRole('button', { name: 'Add mode', exact: true }).click();
    await panel.getByPlaceholder('Mode name').last().fill('Dim');
    await panel.getByRole('button', { name: 'Create dimension', exact: true }).click();
    await selectVariable(page, 'Ink');
    await expect(page.getByLabel('Dimension of Ink', { exact: true })).toHaveValue('');
    await page
        .getByLabel('Dimension of Ink', { exact: true })
        .selectOption({ label: 'Appearance' });
    await expect(page.getByText('Uses Default value', { exact: true })).toBeVisible();
    await page.getByLabel('Dim value of Ink', { exact: true }).fill('#ddeeff');
    await expect.poll(fill).toBe('rgb(17, 34, 51)');
    await openModePreview(page);
    await page.getByLabel('Preview Appearance', { exact: true }).selectOption({ label: 'Dim' });
    await expect.poll(fill).toBe('rgb(221, 238, 255)');
    expect(await rect.boundingBox()).toEqual(bounds);
    const selectedMode = await page.getByLabel('Preview Appearance', { exact: true }).inputValue();
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    await page.getByLabel('Name of mode Dim in Appearance', { exact: true }).fill('Night');
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByLabel('Preview Appearance', { exact: true })).toHaveValue(selectedMode);
    await panel.getByLabel('Actions for mode Night', { exact: true }).click();
    await panel
        .getByRole('group', { name: 'Actions for mode Night menu', exact: true })
        .getByRole('button', { name: 'Move up', exact: true })
        .click();
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click();
    await panel.getByRole('button', { name: 'Back to Ink', exact: true }).click();
    await expect(page.getByLabel('Night value of Ink', { exact: true })).toHaveValue('#ddeeff');
    await expect
        .poll(() =>
            page.evaluate(() =>
                JSON.stringify(
                    JSON.parse(localStorage.getItem('reactor:view') ?? '{}').previewModes
                )
            )
        )
        .toContain(selectedMode);
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await openEditor(page, ['Inspector', 'Variables']);
    await openModePreview(page);
    await expect(page.getByLabel('Preview Appearance', { exact: true })).toHaveValue(selectedMode);
    await expect.poll(fill).toBe('rgb(221, 238, 255)');
    await pointer(page, 'pointerdown', { x: 125, y: 125 });
    await pointer(page, 'pointerup', { x: 125, y: 125 });
    await expect(page.getByLabel('Fill', { exact: true })).toHaveText('◆ Ink');
    await page.setViewportSize({ width: 700, height: 800 });
    await openModePreview(page);
    await expect(page.getByLabel('Preview Appearance', { exact: true })).toBeVisible();
    await resetModeValue(page, 'Ink', 'Night', 'Default');
    await expect.poll(fill).toBe('rgb(17, 34, 51)');
    await panel.getByRole('button', { name: 'Manage modes', exact: true }).click();
    await panel.getByRole('button', { name: 'Dimension actions', exact: true }).click();
    await panel.getByRole('button', { name: 'Delete dimension', exact: true }).click();
    await page
        .getByRole('group', { name: 'Confirm deletion' })
        .getByRole('button', { name: 'Delete', exact: true })
        .click();
    await selectVariable(page, 'Ink');
    await expect(page.getByLabel('Preview Appearance', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Dimension of Ink', { exact: true })).toHaveValue('');
    await expect.poll(fill).toBe('rgb(17, 34, 51)');
});

test('legacy Light/Dark documents preserve their values and local Dark selection', async ({
    page
}) => {
    const document = createDocument({
        variables: {
            ink: {
                id: 'ink',
                name: 'Ink',
                type: 'color',
                values: { default: '#112233', dark: '#ddeeff' }
            }
        }
    });
    const saved = JSON.parse(
        JSON.stringify(
            serializePersistedState({
                documents: { [document.id]: document },
                currentDocumentId: document.id
            })
        )
    );
    delete saved.documents[document.id].dimensions;
    delete saved.documents[document.id].variables.ink.dimensionId;
    await page.addInitScript(
        ({ saved, documentId }) => {
            localStorage.setItem('reactor', JSON.stringify(saved));
            localStorage.setItem(
                'reactor:view',
                JSON.stringify({ currentDocumentId: documentId, previewTheme: 'dark', cameras: {} })
            );
        },
        { saved, documentId: document.id }
    );
    await openEditor(page, ['Variables']);
    await openModePreview(page);
    await expect(page.getByLabel('Preview Theme', { exact: true })).toHaveValue('dark');
    await expect(page.getByLabel('Dark value of Ink', { exact: true })).toHaveValue('#ddeeff');
    await expect(page.getByLabel('Value of Ink', { exact: true })).toHaveValue('#112233');
    await expect(
        page
            .getByRole('group', { name: 'Light (default)', exact: true })
            .getByLabel('Value of Ink', { exact: true })
    ).toHaveValue('#112233');
});
