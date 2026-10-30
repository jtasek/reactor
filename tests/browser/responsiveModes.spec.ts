import { expect, test, type Page } from '@playwright/test';
import { responsiveDocument } from '../support/responsiveModes';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';
import { variablesPanel } from './support/variables';

async function openResponsive(page: Page, manual = false) {
    const document = responsiveDocument();
    if (manual) {
        delete document.dimensions.media.selection;
        Object.values(document.dimensions.media.modes).forEach((mode) => delete mode.minWidth);
    }
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openEditor(page, ['Inspector', 'Variables']);
    await page.getByRole('button', { name: 'More panels', exact: true }).click();

    return {
        mobile: page.locator('#screen-views > [data-screen-view="mobile"]'),
        desktop: page.locator('#screen-views > [data-screen-view="desktop"]'),
        inspector: page.locator('[data-panel="inspector"]'),
        panel: variablesPanel(page)
    };
}

test('resizes each Screen view independently, keeps Theme and explicit overrides, and previews the result', async ({
    page
}) => {
    const { mobile, desktop, inspector } = await openResponsive(page);
    const button = mobile.locator('[data-cy="Button"]');
    await expect(button).toHaveAttribute('width', '80');
    await expect(button).toHaveCSS('fill', 'rgb(221, 238, 255)');
    await expect(desktop.locator('[data-cy="Button"]')).toHaveAttribute('width', '240');
    await expect(desktop.locator('[data-cy="Button"]')).toHaveCSS('fill', 'rgb(17, 34, 51)');
    await page.locator('#frames > [data-frame="mobile"]').press('Enter');
    await expect(inspector).toContainText('xs · Screen width · 360px');
    await inspector.getByLabel('View width', { exact: true }).fill('600');
    await inspector.getByLabel('View width', { exact: true }).press('Enter');
    await expect(button).toHaveAttribute('width', '240');
    await expect(inspector).toContainText('lg · Screen width · 600px');
    await expect(button).toHaveCSS('fill', 'rgb(221, 238, 255)');
    await inspector.getByLabel('MediaSize mode', { exact: true }).selectOption('sm');
    await expect(button).toHaveAttribute('width', '120');
    await inspector.getByLabel('MediaSize mode', { exact: true }).selectOption('');
    await expect(button).toHaveAttribute('width', '240');
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await expect(button).toHaveAttribute('width', '240');
    await page.locator('#frames > [data-frame="mobile"]').press('Enter');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const runtime = page.frameLocator('iframe[title="Application preview"]');
    await expect(runtime.locator('rect[width="240"]')).toHaveCount(1);
    await expect(runtime.locator('text')).toHaveAttribute('font-size', '20');
});

test('authors optional rules without changing values, rejects duplicate widths and can return to manual selection', async ({
    page
}) => {
    const { mobile, desktop, panel } = await openResponsive(page, true);
    await expect(mobile.locator('[data-cy="Button"]')).toHaveAttribute('width', '120');
    await panel.getByRole('tab', { name: 'Dimensions', exact: true }).click();
    await panel.getByRole('button', { name: 'Edit dimension MediaSize', exact: true }).click();
    await expect(panel.getByLabel('Select modes by')).toHaveValue('manual');
    await panel.getByLabel('Select modes by').selectOption('width');
    await panel.getByLabel('Minimum screen width for xs', { exact: true }).fill('0');
    await panel.getByLabel('Minimum screen width for sm', { exact: true }).fill('400');
    await panel.getByLabel('Minimum screen width for lg', { exact: true }).fill('400');
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('different minimum width');
    await panel.getByLabel('Minimum screen width for lg', { exact: true }).fill('600');
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(mobile.locator('[data-cy="Button"]')).toHaveAttribute('width', '80');
    await expect(desktop.locator('[data-cy="Button"]')).toHaveAttribute('width', '240');
    await panel.getByLabel('Name of dimension MediaSize').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/responsive-modes-wide.png' });
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(panel.getByLabel('Select modes by')).toBeVisible();
    await panel.getByLabel('Minimum screen width for lg', { exact: true }).scrollIntoViewIfNeeded();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
    );
    await page.screenshot({ path: 'test-results/responsive-modes-narrow.png' });
    await panel.getByLabel('Select modes by').selectOption('manual');
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(mobile.locator('[data-cy="Button"]')).toHaveAttribute('width', '120');
    await expect(desktop.locator('[data-cy="Button"]')).toHaveAttribute('width', '120');
    await panel.getByLabel('Select modes by').selectOption('width');
    await expect(panel.getByLabel('Minimum screen width for lg', { exact: true })).toHaveValue(
        '600'
    );
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await panel.getByLabel('Selected dimension').selectOption('theme');
    await expect(panel.getByLabel('Select modes by')).toHaveValue('manual');
});

for (const explicit of [false, true]) {
    test(`Preview width ${explicit ? 'preserves explicit modes' : 'recomputes automatic modes'} while keeping Theme`, async ({
        page
    }) => {
        const { mobile, inspector } = await openResponsive(page);
        await page.locator('#frames > [data-frame="mobile"]').press('Enter');
        if (explicit) {
            await inspector.getByLabel('MediaSize mode', { exact: true }).selectOption('xs');
        }
        await page.getByRole('button', { name: 'Preview', exact: true }).click();
        const runtime = page.frameLocator('iframe[title="Application preview"]');
        await expect(runtime.locator('rect')).toHaveAttribute('width', '80');
        await runtime.getByLabel('Preview width').fill('800');
        await runtime.getByLabel('Preview width').press('Tab');
        await expect(runtime.locator('svg')).toHaveAttribute('width', '800');
        await expect(runtime.locator('rect')).toHaveAttribute('width', explicit ? '80' : '240');
        await expect(runtime.locator('text')).toHaveAttribute('font-size', explicit ? '14' : '20');
        await expect(runtime.locator('rect')).toHaveAttribute('fill', '#ddeeff');
        await expect(mobile.locator('[data-cy="Button"]')).toHaveAttribute('width', '80');
    });
}
