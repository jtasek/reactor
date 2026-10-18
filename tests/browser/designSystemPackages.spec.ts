import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createDocument } from 'src/app/factories';
import { exportDesignSystemPackage } from 'src/app/designSystemPackages';
import { openEditor } from './support/editor';

const packageText = (value = '#112233', name = 'Ink') =>
    exportDesignSystemPackage(
        createDocument({
            id: 'brand-package',
            name: 'Brand',
            variables: {
                ink: { id: 'ink', name, type: 'color', values: { default: value } },
                foreground: {
                    id: 'foreground',
                    name: 'Foreground',
                    type: 'color',
                    alias: 'ink',
                    values: { default: '#000000' }
                }
            }
        })
    );

test('reviews imports, offers reuse/replace/separate, exports identities and rejects malformed packages', async ({
    page
}) => {
    await openEditor(page, ['Variables']);
    await page.getByLabel('New variable name', { exact: true }).fill('Ink');
    await page
        .getByRole('region', { name: 'Variables' })
        .getByRole('button', { name: 'Add', exact: true })
        .click();
    await page.getByText('Design-system import / export', { exact: true }).click();
    const upload = async (text: string) =>
        page.getByLabel('Design-system package', { exact: true }).setInputFiles({
            name: 'brand.json',
            mimeType: 'application/json',
            buffer: Buffer.from(text)
        });
    await upload(packageText());
    await expect(page.getByLabel('Import preview')).toContainText('Ink (color) — matches Ink');
    await expect(page.getByLabel('Value of Ink', { exact: true })).toHaveValue('#000000');
    await page.getByRole('button', { name: 'Apply import', exact: true }).click();
    await expect(page.getByLabel('Value of Ink', { exact: true })).toHaveValue('#000000');
    await expect(page.getByLabel('Source of Foreground', { exact: true })).toContainText(
        'Follow Ink'
    );
    await upload(packageText());
    await page.getByLabel('Import conflict handling').selectOption('replace');
    await page.getByRole('button', { name: 'Apply import', exact: true }).click();
    await expect(page.getByLabel('Value of Ink', { exact: true })).toHaveValue('#112233');
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await openEditor(page, ['Variables']);
    await expect(page.getByLabel('Value of Ink', { exact: true })).toHaveValue('#112233');
    await page.getByText('Design-system import / export', { exact: true }).click();
    await upload(packageText('#aabbcc', 'Brand/Ink'));
    await expect(page.getByLabel('Import preview')).toContainText(
        'Brand/Ink (color) — matches Ink'
    );
    await page.getByLabel('Import conflict handling').selectOption('replace');
    await page.getByRole('button', { name: 'Apply import', exact: true }).click();
    await expect(page.getByLabel('Value of Brand/Ink', { exact: true })).toHaveValue('#aabbcc');
    await upload(packageText('#aabbcc', 'Brand/Ink'));
    await page.getByLabel('Import conflict handling').selectOption('separate');
    await page.getByRole('button', { name: 'Apply import', exact: true }).click();
    await expect(page.getByLabel('Name of Brand/Ink 2', { exact: true })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export design system', exact: true }).click();
    const exported = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
    expect(exported.variables).toHaveLength(4);
    expect(exported.variables.find((v: { name: string }) => v.name === 'Brand/Ink').source).toEqual(
        { packageId: 'brand-package', tokenId: 'ink' }
    );
    await upload('{"format":"wrong","version":1}');
    await expect(page.getByRole('alert')).toContainText('Unsupported');
    await expect(page.getByRole('button', { name: 'Apply import', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Value of Brand/Ink', { exact: true })).toHaveValue('#aabbcc');
    await upload(packageText('#ffffff', 'Brand/Ink'));
    await page.getByRole('button', { name: 'Cancel import', exact: true }).click();
    await expect(page.getByLabel('Value of Brand/Ink', { exact: true })).toHaveValue('#aabbcc');
});

test('shows a usable import preview at narrow widths', async ({ page }) => {
    await openEditor(page, ['Variables']);
    await page.setViewportSize({ width: 700, height: 800 });
    await page.getByText('Design-system import / export', { exact: true }).click();
    await page.getByLabel('Design-system package', { exact: true }).setInputFiles({
        name: 'brand.json',
        mimeType: 'application/json',
        buffer: Buffer.from(packageText())
    });
    await expect(page.getByLabel('Import conflict handling')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply import', exact: true })).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-v4-narrow.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: '/tmp/reactor-v4-normal.png' });
});
