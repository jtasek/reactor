import { expect, test, type Page } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { automaticLayoutsPrototype } from '../support/automaticScreenLayouts';
import { openEditor } from './support/editor';

async function openPrototype(page: Page, compatible = true) {
    const document = automaticLayoutsPrototype(compatible);
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openEditor(page, ['Inspector', 'Explorer']);
    await page.getByRole('button', { name: 'More panels', exact: true }).click();
    await page.locator('#frames > [data-frame="view"]').press('Enter');
}

async function openPreview(page: Page, compatible = true) {
    await openPrototype(page, compatible);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();

    return page.frameLocator('iframe[title="Application preview"]');
}

test('authors width rules and preserves Auto and manual choices through resize and reload', async ({
    page
}) => {
    await openPrototype(page);
    const inspector = page.locator('[data-panel="inspector"]');
    const artwork = page.locator('#screen-views > [data-screen-view="view"]');
    await expect(inspector.getByLabel('Screen view layout')).toHaveValue('__auto');
    await expect(artwork.locator('[data-shape-id="name"]')).toHaveCount(1);
    await inspector.getByLabel('View width', { exact: true }).fill('640');
    await inspector.getByLabel('View width', { exact: true }).press('Tab');
    await expect(artwork.locator('[data-shape-id="wide-name"]')).toHaveCount(1);
    await inspector.getByLabel('View width', { exact: true }).fill('320');
    await inspector.getByLabel('View width', { exact: true }).press('Tab');
    await expect(artwork.locator('[data-shape-id="name"]')).toHaveCount(1);

    await inspector.getByLabel('Layout rule 1 minimum width').fill('300');
    await inspector.getByLabel('Layout rule 1 minimum width').press('Tab');
    await expect(artwork.locator('[data-shape-id="wide-name"]')).toHaveCount(1);
    await expect(inspector.getByLabel('Screen view layout')).toHaveValue('__auto');
    await inspector.getByLabel('Screen view layout').selectOption('');
    await expect(artwork.locator('[data-shape-id="name"]')).toHaveCount(1);
    await inspector.getByLabel('Layout rule 1 minimum width').fill('0');
    await expect(artwork.locator('[data-shape-id="name"]')).toHaveCount(1);
    await inspector.getByLabel('Screen view layout').selectOption('__auto');
    await expect(artwork.locator('[data-shape-id="wide-name"]')).toHaveCount(1);
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await page.locator('#frames > [data-frame="view"]').press('Enter');
    await expect(inspector.getByLabel('Screen view layout')).toHaveValue('__auto');
    await expect(inspector.getByLabel('Layout rule 1 minimum width')).toHaveValue('0');
    await page.screenshot({ path: 'test-results/automatic-layout-inspector.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(inspector.getByLabel('Screen view layout')).toBeVisible();
    await page.screenshot({ path: 'test-results/automatic-layout-inspector-narrow.png' });
});

test('keeps compatible input and navigation through thresholds and local inspection choices', async ({
    page
}) => {
    const runtime = await openPreview(page);
    const input = runtime.getByRole('textbox', { name: 'Your name', exact: true });
    const width = runtime.getByLabel('Preview width');
    await input.fill('Ada');
    await width.fill('639');
    await width.press('Tab');
    await expect(runtime.locator('svg[aria-label="Home"]')).toHaveAttribute(
        'viewBox',
        '0 0 639 480'
    );
    await expect(input).toHaveValue('Ada');
    await width.fill('640');
    await width.press('Tab');
    await expect(runtime.locator('svg[aria-label="Home"]')).toHaveAttribute(
        'viewBox',
        '1000 0 640 480'
    );
    await expect(input).toHaveValue('Ada');
    await runtime.getByLabel('Preview layout').selectOption('"home"');
    await expect(runtime.locator('svg[aria-label="Home"]')).toHaveAttribute(
        'viewBox',
        '0 0 640 480'
    );
    await width.fill('900');
    await width.press('Tab');
    await expect(runtime.locator('svg[aria-label="Home"]')).toHaveAttribute(
        'viewBox',
        '0 0 900 480'
    );
    await expect(input).toHaveValue('Ada');
    await runtime.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(runtime.getByLabel('Preview screen')).toHaveValue('details');
    await expect(width).toHaveValue('900');
    await width.fill('800');
    await width.press('Tab');
    await expect(runtime.getByLabel('Preview screen')).toHaveValue('details');
    await runtime.getByLabel('Preview screen').selectOption('home');
    await expect(runtime.getByLabel('Preview layout')).toHaveValue('"home"');
    await expect(input).toHaveValue('Ada');
    await runtime.getByLabel('Preview layout').selectOption('null');
    await expect(runtime.locator('svg[aria-label="Home"]')).toHaveAttribute(
        'viewBox',
        '1000 0 800 480'
    );
    await expect(input).toHaveValue('Ada');
    await page.screenshot({ path: 'test-results/automatic-layout-preview.png' });
    await runtime.getByRole('button', { name: 'Reset preview' }).click();
    await expect(input).toHaveValue('Your name');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(
        page.locator('[data-panel="inspector"]').getByLabel('Screen view layout')
    ).toHaveValue('__auto');
    await expect(
        page.locator('#screen-views > [data-screen-view="view"] [data-shape-id="name"]')
    ).toHaveCount(1);
});

test('resets incompatible inputs instead of transferring values between different properties', async ({
    page
}) => {
    const runtime = await openPreview(page, false);
    const input = runtime.getByRole('textbox', { name: 'Your name', exact: true });
    const width = runtime.getByLabel('Preview width');
    await input.fill('Ada');
    await width.fill('800');
    await width.press('Tab');
    await expect(runtime.locator('svg[aria-label="Home"]')).toHaveAttribute(
        'viewBox',
        '1000 0 800 480'
    );
    await expect(input).toHaveValue('Your name');
    await input.fill('Grace');
    await width.fill('320');
    await width.press('Tab');
    await expect(runtime.locator('svg[aria-label="Home"]')).toHaveAttribute(
        'viewBox',
        '0 0 320 480'
    );
    await expect(input).toHaveValue('Your name');
});

test('edits an instance input identity through the Inspector and persists it', async ({ page }) => {
    await openPrototype(page);
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Name field', exact: true }).click();
    const identity = page.getByLabel('Input identity', { exact: true });
    await expect(identity).toHaveValue('person-name');
    await identity.fill('billing-name');
    await identity.press('Tab');
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await explorer.getByRole('button', { name: 'Name field', exact: true }).click();
    await expect(identity).toHaveValue('billing-name');
});

test('width inspection keeps another destination’s height constraint', async ({ page }) => {
    const document = automaticLayoutsPrototype();
    document.frames.details.sizing = { height: { mode: 'fixed', min: 700 } };
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page);
    await page.locator('#frames > [data-frame="view"]').press('Enter');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const runtime = page.frameLocator('iframe[title="Application preview"]');
    await runtime.getByLabel('Preview screen').selectOption('details');
    await expect(runtime.locator('svg')).toHaveAttribute('height', '700');
    await runtime.getByLabel('Preview width').fill('800');
    await runtime.getByLabel('Preview width').press('Tab');
    await expect(runtime.locator('svg')).toHaveAttribute('width', '800');
    await expect(runtime.locator('svg')).toHaveAttribute('height', '700');
});
