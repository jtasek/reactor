import { expect, test, type Page } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { automaticLayoutsPrototype } from '../support/automaticScreenLayouts';
import { openEditor } from './support/editor';

async function openInteractions(page: Page) {
    const document = automaticLayoutsPrototype();
    document.frames.view.position = { x: 400, y: 200 };
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openEditor(page, ['Inspector', 'Explorer']);
    await page.getByRole('button', { name: 'More panels', exact: true }).click();

    return page.getByRole('region', { name: 'Explorer' });
}

test('edits source and instance actions independently, preserves them on reload, and never navigates on canvas clicks', async ({
    page
}) => {
    const explorer = await openInteractions(page);
    await explorer.getByRole('button', { name: 'Button', exact: true }).click();
    const role = page.getByRole('combobox', { name: 'Semantic role', exact: true });
    const action = page.getByLabel('Navigate to screen');
    await expect(action).toHaveValue('"details"');
    await role.selectOption('none');
    await expect(action).toHaveValue('"details"');
    await page.getByRole('button', { name: 'Back to canvas', exact: true }).click();
    // Canvas activation only selects the instance and never opens a player.
    const hit = page.locator(
        '#screen-views > [data-screen-view="view"] [data-shape-id="next"] [data-view-instance-hit]'
    );
    await hit.click();
    await expect(role).toHaveValue('inherit');
    await expect(action).toHaveValue('inherit');
    await expect(page.locator('iframe[title="Application preview"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.frameLocator('iframe[title="Application preview"]');
    await expect(preview.getByLabel('Preview screen')).toHaveValue('home');
    await action.selectOption('none');
    await expect(preview.getByRole('button', { name: 'Continue button', exact: true })).toHaveCount(
        0
    );
    await action.selectOption({ label: 'Navigate to Details' });
    await preview.getByRole('button', { name: 'Continue button', exact: true }).press('Enter');
    await expect(preview.getByLabel('Preview screen')).toHaveValue('details');
    await action.selectOption('inherit');
    await expect(
        page.getByText('From source: navigate to Details.', { exact: false })
    ).toBeVisible();
    await action.selectOption({ label: 'Navigate to Home' });
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.reload();
    await hit.click();
    await expect(action).toHaveValue('"home"');
    await expect(role).toHaveValue('inherit');
    await action.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/screen-interactions.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeVisible();
    const field = await action.boundingBox();
    const panel = await page.locator('[data-panel="inspector"]').boundingBox();
    expect(field!.x + field!.width).toBeLessThanOrEqual(panel!.x + panel!.width);
    await page.screenshot({ path: 'test-results/screen-interactions-narrow.png' });
});

test('activates an input on Enter without navigating on focus and retains typed values across layouts', async ({
    page
}) => {
    const explorer = await openInteractions(page);
    await explorer.getByRole('button', { name: 'Input', exact: true }).click();
    await page.getByLabel('Navigate to screen').selectOption({ label: 'Navigate to Details' });
    await page.getByRole('button', { name: 'Back to canvas', exact: true }).click();
    // Old input role overrides retain the former no-action behavior until inheritance is chosen.
    const inputHit = page.locator(
        '#screen-views > [data-screen-view="view"] [data-shape-id="name"] [data-view-instance-hit]'
    );
    await inputHit.click();
    await page.getByLabel('Navigate to screen').selectOption('inherit');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.frameLocator('iframe[title="Application preview"]');
    const input = preview.getByRole('textbox', { name: 'Your name', exact: true });
    await input.fill('Ada');
    await expect(preview.getByLabel('Preview screen')).toHaveValue('home');
    await input.press('Enter');
    await expect(preview.getByLabel('Preview screen')).toHaveValue('details');
    await preview.getByLabel('Preview screen').selectOption('home');
    await expect(input).toHaveValue('Ada');
    await preview.getByLabel('Preview width').fill('800');
    await preview.getByLabel('Preview width').press('Tab');
    await expect(input).toHaveValue('Ada');
    // The alternate's legacy role override remains independent of the source action.
    await input.press('Enter');
    await expect(preview.getByLabel('Preview screen')).toHaveValue('home');
});
