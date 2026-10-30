import { expect, test, type Page } from '@playwright/test';
import { screenLayoutsDocument } from '../support/screenLayouts';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor, pointer, selectTool } from './support/editor';

async function openLayouts(page: Page, document = screenLayoutsDocument()) {
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
        inspector: page.locator('[data-panel="inspector"]')
    };
}

const selectView = (page: Page, id: string) =>
    page.locator(`#frames > [data-frame="${id}"]`).press('Enter');

test('chooses separate artwork, previews the same destination and retains choices after reload', async ({
    page
}) => {
    const { mobile, desktop, inspector } = await openLayouts(page);
    await expect(desktop.locator('[data-cy="Default body"]')).toHaveAttribute('width', '280');
    await expect(mobile.locator('[data-cy="Compact body"]')).toHaveAttribute('width', '200');
    await expect(mobile.locator('[data-cy="Default body"]')).toHaveCount(0);
    await selectView(page, 'mobile');
    const choice = inspector.getByLabel('Screen view layout', { exact: true });
    await expect(choice).toHaveValue('compact');
    await expect(inspector).toContainText('Edits belong to “Compact”');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const runtime = page.frameLocator('iframe[title="Application preview"]');
    await expect(runtime.locator('rect[width="200"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await choice.selectOption('');
    await expect(mobile.locator('[data-cy="Default body"]')).toHaveAttribute('width', '220');
    await expect(mobile.locator('[data-cy="Compact body"]')).toHaveCount(0);
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await expect(explorer.getByRole('button', { name: 'Default body', exact: true })).toHaveCount(
        2
    );
    await expect(explorer.getByRole('button', { name: 'Compact body', exact: true })).toHaveCount(
        0
    );
    await choice.selectOption('compact');
    await page.screenshot({ path: 'test-results/screen-layouts-inspector.png' });
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await selectView(page, 'mobile');
    await expect(choice).toHaveValue('compact');
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(choice).toBeVisible();
    await page.screenshot({ path: 'test-results/screen-layouts-narrow.png' });
});

test('creates a named empty layout and draws into it without modifying the default', async ({
    page
}) => {
    const { mobile, desktop, inspector } = await openLayouts(page);
    await selectView(page, 'mobile');
    await inspector.getByLabel('New layout name').fill('Tablet');
    await inspector.getByRole('button', { name: 'Create empty layout', exact: true }).click();
    await expect(inspector.getByLabel('Screen view layout')).not.toHaveValue('compact');
    await expect(inspector).toContainText('Edits belong to “Tablet”');
    await expect(mobile.locator('g[data-shape-id]')).toHaveCount(0);
    await selectTool(page, 'Draws a rectangle or square');
    await pointer(page, 'pointerdown', {
        x: 540,
        y: 140,
        target: '#screen-views > [data-screen-view="mobile"] > rect'
    });
    await pointer(page, 'pointermove', { x: 600, y: 190 });
    await pointer(page, 'pointerup', { x: 600, y: 190 });
    await expect(mobile.locator('g[data-shape-id]')).toHaveCount(1);
    await expect(desktop.locator('[data-cy="Default body"]')).toHaveAttribute('width', '280');
    await selectView(page, 'mobile');
    await inspector.getByLabel('Screen view layout').selectOption('compact');
    await expect(mobile.locator('[data-cy="Compact body"]')).toHaveCount(1);
    await expect(mobile.locator('g[data-shape-id]')).toHaveCount(1);
    await inspector.getByRole('button', { name: 'Edit layout settings', exact: true }).click();
    await expect(inspector).toContainText('Size and position follow each Screen view');
    await expect(inspector.getByLabel('Width', { exact: true })).toHaveCount(0);
    await expect(inspector.getByLabel('Frame parent', { exact: true })).toHaveCount(0);
});

test('previews an alternate while the unused default layout overflows', async ({ page }) => {
    const document = screenLayoutsDocument();
    const body = document.shapes.body;

    if (body.type !== 'rectangle') {
        throw new Error('Expected rectangle fixture');
    }

    body.size.height = 500;
    const { mobile } = await openLayouts(page, document);
    await selectView(page, 'mobile');
    await expect(mobile).not.toContainText('Contents overflow');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const runtime = page.frameLocator('iframe[title="Application preview"]');
    await expect(runtime.locator('rect[width="200"]')).toHaveCount(1);
});
