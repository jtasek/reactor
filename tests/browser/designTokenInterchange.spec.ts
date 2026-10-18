import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openEditor } from './support/editor';

const tokens = {
    brand: {
        $type: 'color',
        ink: { $value: { colorSpace: 'srgb', components: [0.2, 0.4, 1] } },
        foreground: { $value: '{brand.ink}' }
    },
    scale: { $type: 'number', zero: { $value: 0 }, reference: { $ref: '#/scale%2Fzero/$value' } }
};

test('previews and imports DTCG tokens, retains aliases on reload, and exports identities', async ({
    page
}) => {
    await openEditor(page, ['Variables']);
    await page.getByText('Design-system import / export', { exact: true }).click();
    await page.getByLabel('Design-system format').selectOption('dtcg');
    await page.getByLabel('Design-system package', { exact: true }).setInputFiles({
        name: 'brand.tokens.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(tokens))
    });
    await expect(page.getByLabel('Import preview')).toContainText('brand/ink (color) — new');
    await expect(page.getByLabel('Name of brand/ink', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Apply import', exact: true }).click();
    await expect(page.getByLabel('Value of brand/ink', { exact: true })).toHaveValue('#3366ff');
    await expect(page.getByLabel('Value of scale/zero', { exact: true })).toHaveValue('0');
    await expect(page.getByLabel('Source of scale/reference', { exact: true })).toContainText(
        'Follow scale/zero'
    );
    await expect(page.getByLabel('Source of brand/foreground', { exact: true })).toContainText(
        'Follow brand/ink'
    );
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await openEditor(page, ['Variables']);
    await expect(page.getByLabel('Value of brand/ink', { exact: true })).toHaveValue('#3366ff');
    await expect(page.getByLabel('Source of brand/foreground', { exact: true })).toContainText(
        'Follow brand/ink'
    );
    await page.getByText('Design-system import / export', { exact: true }).click();
    await page.getByLabel('Design-system format').selectOption('dtcg');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export design system', exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('design-system.tokens.json');
    const output = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(output.brand.foreground.$value).toBe('{brand.ink}');
    expect(output.scale.reference.$value).toBe('{scale.zero}');
    expect(output.brand.ink.$extensions['io.github.jtasek.reactor'].source.packageId).toBe(
        'dtcg:brand.tokens.json'
    );
    await page.setViewportSize({ width: 700, height: 800 });
    await expect(page.getByLabel('Design-system format')).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-v5-narrow.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: '/tmp/reactor-v5-normal.png' });
});

test('rejects unsupported DTCG units and clears previews when switching formats', async ({
    page
}) => {
    await openEditor(page, ['Variables']);
    await page.getByLabel('New variable name', { exact: true }).fill('Local');
    await page
        .getByRole('region', { name: 'Variables' })
        .getByRole('button', { name: 'Add', exact: true })
        .click();
    await page.getByText('Design-system import / export', { exact: true }).click();
    await page.getByLabel('Design-system format').selectOption('dtcg');
    const upload = (data: unknown) =>
        page.getByLabel('Design-system package', { exact: true }).setInputFiles({
            name: 'brand.tokens.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(data))
        });
    await upload({ spacing: { $type: 'dimension', $value: { value: 8, unit: 'px' } } });
    await expect(page.getByRole('alert')).toContainText(
        'spacing: Unsupported token type dimension'
    );
    await expect(page.getByRole('button', { name: 'Apply import', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Value of Local', { exact: true })).toHaveValue('#000000');
    await upload(tokens);
    await expect(page.getByLabel('Import preview')).toBeVisible();
    await page.getByLabel('Design-system format').selectOption('native');
    await expect(page.getByLabel('Import preview')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Apply import', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Value of Local', { exact: true })).toHaveValue('#000000');
});

test('refuses a partial DTCG export and leaves native export available', async ({ page }) => {
    await openEditor(page, ['Variables']);
    await page.getByLabel('New variable name', { exact: true }).fill('Label');
    await page.getByLabel('New variable type', { exact: true }).selectOption('text');
    await page
        .getByRole('region', { name: 'Variables' })
        .getByRole('button', { name: 'Add', exact: true })
        .click();
    await page.getByText('Design-system import / export', { exact: true }).click();
    await page.getByLabel('Design-system format').selectOption('dtcg');
    await page.getByRole('button', { name: 'Export design system', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Use the native format');
    await page.getByLabel('Design-system format').selectOption('native');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export design system', exact: true }).click();
    expect((await pending).suggestedFilename()).toBe('design-system.reactor.json');
});
