import { expect, test, type Page } from '@playwright/test';
import { responsiveVariantsDocument } from '../support/responsiveVariants';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

async function openResponsive(page: Page) {
    const document = responsiveVariantsDocument();
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openEditor(page, ['Inspector', 'Explorer']);
    await page.getByRole('button', { name: 'More panels', exact: true }).click();

    return {
        mobile: page.locator('#screen-views > [data-screen-view="mobile"]'),
        desktop: page.locator('#screen-views > [data-screen-view="desktop"]'),
        inspector: page.locator('[data-panel="inspector"]'),
        explorer: page.getByRole('region', { name: 'Explorer' })
    };
}

test('resolves each view, explains Auto and preserves content through explicit choices and reload', async ({
    page
}) => {
    const { mobile, desktop, inspector } = await openResponsive(page);
    await expect(mobile.locator('text').filter({ hasText: /^Continue$/ })).toHaveCSS(
        'font-size',
        '16px'
    );
    await expect(desktop.locator('text').filter({ hasText: /^Continue$/ })).toHaveCSS(
        'font-size',
        '32px'
    );
    await desktop
        .locator('[data-shape-id="button"] [data-view-instance-hit]')
        .click({ force: true });
    const variant = inspector.getByRole('combobox', { name: 'Component variant' });
    await expect(variant).toHaveValue('__auto');
    await expect(inspector).toContainText('Screen view width 800px');
    await expect(inspector).toContainText('≥ 600px → Button Wide');
    await expect(inspector.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue(
        'Continue'
    );
    await variant.selectOption('family');
    await expect(desktop.locator('text').filter({ hasText: /^Continue$/ })).toHaveCSS(
        'font-size',
        '16px'
    );
    await variant.selectOption('wide');
    await expect(mobile.locator('text').filter({ hasText: /^Continue$/ })).toHaveCSS(
        'font-size',
        '32px'
    );
    await variant.selectOption('__auto');
    await expect(mobile.locator('text').filter({ hasText: /^Continue$/ })).toHaveCSS(
        'font-size',
        '16px'
    );
    await page.screenshot({ path: 'test-results/responsive-variants-inspector.png' });
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await expect(desktop.locator('text').filter({ hasText: /^Continue$/ })).toHaveCSS(
        'font-size',
        '32px'
    );
    await page.locator('#frames > [data-frame="mobile"]').press('Enter');
    await inspector.getByLabel('View width', { exact: true }).fill('600');
    await inspector.getByLabel('View width', { exact: true }).press('Enter');
    await expect(mobile.locator('text').filter({ hasText: /^Continue$/ })).toHaveCSS(
        'font-size',
        '32px'
    );
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const runtime = page.frameLocator('iframe[title="Application preview"]');
    await expect(runtime.locator('text').filter({ hasText: /^Continue$/ })).toHaveAttribute(
        'font-size',
        '32'
    );
});

test('authors width rules, rejects duplicates and keeps the controls usable at narrow widths', async ({
    page
}) => {
    const { inspector, explorer } = await openResponsive(page);
    await explorer.getByRole('button', { name: 'Button', exact: true }).click();
    const rules = inspector.getByRole('region', { name: 'Responsive variants' });
    await rules.getByLabel('Measure', { exact: true }).selectOption('parent');
    await rules.getByRole('spinbutton', { name: 'Minimum width (px)', exact: true }).fill('200');
    await rules.getByRole('button', { name: 'Add width rule', exact: true }).click();
    await rules
        .getByRole('spinbutton', { name: 'Minimum width (px)', exact: true })
        .nth(1)
        .fill('200');
    await expect(rules.getByRole('alert')).toContainText('must be different');
    await expect(rules.getByRole('button', { name: 'Save rules', exact: true })).toBeDisabled();
    await rules.getByRole('button', { name: 'Remove rule 2', exact: true }).click();
    // An empty threshold asks for a number even when it would also read as a duplicate 0.
    await rules.getByRole('button', { name: 'Add width rule', exact: true }).click();
    await rules
        .getByRole('spinbutton', { name: 'Minimum width (px)', exact: true })
        .nth(1)
        .fill('0');
    await rules.getByRole('button', { name: 'Add width rule', exact: true }).click();
    await expect(rules.getByRole('alert')).toContainText('minimum width of zero or greater');
    await rules.getByRole('button', { name: 'Remove rule 3', exact: true }).click();
    await rules.getByRole('button', { name: 'Remove rule 2', exact: true }).click();
    await rules.getByRole('button', { name: 'Save rules', exact: true }).click();
    // The saved rule stays in the editor after the save.
    await expect(
        rules.getByRole('spinbutton', { name: 'Minimum width (px)', exact: true })
    ).toHaveValue('200');
    await expect(rules.getByRole('button', { name: 'Save rules', exact: true })).toBeDisabled();
    await page.screenshot({ path: 'test-results/responsive-variants-rules.png' });
    await page.setViewportSize({ width: 390, height: 800 });
    await rules.getByRole('button', { name: 'Save rules', exact: true }).scrollIntoViewIfNeeded();
    expect(await inspector.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
    );
    await page.screenshot({ path: 'test-results/responsive-variants-narrow.png' });
});

test('edits the family source through an Auto instance and restores the responsive result on exit', async ({
    page
}) => {
    const { desktop, inspector } = await openResponsive(page);
    await desktop
        .locator('[data-shape-id="button"] [data-view-instance-hit]')
        .click({ force: true });
    await page
        .getByRole('list', { name: 'Commands' })
        .getByRole('button', { name: 'Select component source', exact: true })
        .click();
    const navigation = page.getByRole('navigation', { name: 'Component editing' });
    await expect(navigation).toContainText('Home · Desktop');
    const source = desktop.locator('[data-shape-id="base-text"]');
    await expect(source.locator('text')).toHaveText('Default');
    await expect(desktop.locator('[data-shape-id="wide-text"]')).toHaveCount(0);
    await source.click({ force: true });
    await expect(inspector.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
        'Base text'
    );
    await navigation.getByRole('button', { name: 'Back to canvas', exact: true }).click();
    await expect(desktop.locator('text').filter({ hasText: /^Continue$/ })).toHaveCSS(
        'font-size',
        '32px'
    );
    await expect(inspector.getByRole('combobox', { name: 'Component variant' })).toHaveValue(
        '__auto'
    );
});
