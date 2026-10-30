import { expect, test, type Page } from '@playwright/test';
import { responsiveDocument } from '../support/responsiveModes';
import { serializePersistedState } from 'src/app/services/documentStorage';

async function seed(page: Page, many = false) {
    const document = responsiveDocument();
    if (many) {
        for (let index = 0; index < 600; index++) {
            const id = `token-${index}`;
            document.variables[id] = {
                id,
                name: `palette/${String(index).padStart(3, '0')}`,
                type: 'color',
                values: { default: '#336699' }
            };
        }
    }
    await page.addInitScript(
        (raw) => localStorage.setItem('reactor', raw),
        JSON.stringify(
            serializePersistedState({
                currentDocumentId: document.id,
                documents: { [document.id]: document }
            })
        )
    );
}

test('opens directly, searches a large library, edits values and retains them on reload', async ({
    page
}) => {
    await seed(page, true);
    await page.goto('/variables');
    const workspace = page.getByRole('region', { name: 'Variables', exact: true });
    await expect(page.getByRole('heading', { name: 'Variables', exact: true })).toBeVisible();
    await expect(workspace).toContainText('Responsive modes');
    await expect(page.locator('svg#surface')).toHaveCount(0);
    const bounds = (await workspace.boundingBox())!;
    expect(bounds.width).toBe(page.viewportSize()!.width);
    expect(bounds.height).toBe(page.viewportSize()!.height);
    await workspace.getByLabel('Search variables').fill('PALETTE/499');
    await expect(workspace.getByRole('button', { name: /^Edit variable / })).toHaveCount(1);
    await workspace.getByRole('button', { name: 'Edit variable palette/499', exact: true }).click();
    await workspace.getByLabel('Value of palette/499', { exact: true }).fill('#123456');
    await expect(workspace.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await page.reload();
    await workspace.getByLabel('Search variables').fill('palette/499');
    await workspace.getByRole('button', { name: 'Edit variable palette/499', exact: true }).click();
    await expect(workspace.getByLabel('Value of palette/499', { exact: true })).toHaveValue(
        '#123456'
    );
    await workspace.getByLabel('Search variables').fill('does-not-exist');
    await expect(workspace.getByText('No matching variables.', { exact: true })).toBeVisible();
    await expect(workspace.getByLabel('Value of palette/499', { exact: true })).toHaveValue(
        '#123456'
    );
    await workspace.getByLabel('Search variables').fill('');
    await workspace
        .getByRole('button', { name: 'Edit variable palette/599', exact: true })
        .scrollIntoViewIfNeeded();
    await expect(workspace.getByLabel('Search variables')).toBeInViewport();
    await expect(workspace.getByLabel('Value of palette/499', { exact: true })).toBeInViewport();
    await page.screenshot({ path: 'test-results/variables-page-wide.png' });
    await page.setViewportSize({ width: 390, height: 800 });
    await workspace.getByLabel('Search variables').fill('palette/599');
    await workspace.getByLabel('Selected variable', { exact: true }).selectOption('token-599');
    await expect(workspace.getByLabel('Value of palette/599', { exact: true })).toBeVisible();
    expect(await workspace.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
    );
    await page.screenshot({ path: 'test-results/variables-page-narrow.png' });
});

test('opens from the canvas, keeps canvas shortcuts inactive and provides undo and redo, by button and key', async ({
    page
}) => {
    await seed(page);
    await page.goto('/');
    await expect(page.locator('svg#surface')).toBeVisible();
    await page.locator('#frames > [data-frame="mobile"]').press('Enter');
    await page.getByRole('link', { name: 'Variables', exact: true }).click();
    await expect(page).toHaveURL(/\/variables$/);
    await page.getByLabel('Search variables').fill('Ink');
    await page.getByRole('button', { name: 'Edit variable Ink', exact: true }).click();
    await page.getByLabel('Value of Ink', { exact: true }).fill('#ff0000');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByLabel('Value of Ink', { exact: true })).toHaveValue('#112233');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.getByLabel('Value of Ink', { exact: true })).toHaveValue('#ff0000');
    await page.getByRole('heading', { name: 'Variables', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByLabel('Value of Ink', { exact: true })).toHaveValue('#112233');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(page.getByLabel('Value of Ink', { exact: true })).toHaveValue('#ff0000');
    await page.keyboard.press('Delete');
    await page.keyboard.press('r');
    await page.getByRole('button', { name: 'Back to canvas', exact: true }).click();
    await expect(page.locator('#frames > [data-frame="mobile"]')).toBeVisible();
    await expect(
        page.locator('#screen-views > [data-screen-view="desktop"] [data-cy="Button"]')
    ).toHaveCSS('fill', 'rgb(255, 0, 0)');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Variables', exact: true })).toBeVisible();
});

test('protects drafts on canvas return and keeps dimension mode editing available', async ({
    page
}) => {
    await seed(page);
    await page.goto('/variables');
    await page.getByRole('button', { name: 'New variable', exact: true }).click();
    await page.getByLabel('New variable name').fill('Unfinished');
    await page.getByRole('button', { name: 'Back to canvas', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Discard unfinished changes?' })).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(page.getByLabel('New variable name')).toHaveValue('Unfinished');
    await page.getByRole('button', { name: 'Back to canvas', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.locator('svg#surface')).toBeVisible();
    await page.getByRole('link', { name: 'Variables', exact: true }).click();
    await page.getByRole('tab', { name: 'Dimensions', exact: true }).click();
    await page.getByLabel('Search dimensions').fill('Media');
    await page.getByRole('button', { name: 'Edit dimension MediaSize', exact: true }).click();
    await expect(page.getByLabel('Select modes by')).toHaveValue('width');
    await page.getByLabel('Minimum screen width for lg', { exact: true }).fill('700');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByLabel('Minimum screen width for lg', { exact: true })).toHaveValue(
        '700'
    );
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(
        page.getByRole('dialog', { name: 'Export design system', exact: true })
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeFocused();
});

test('protects unfinished dimensions on browser Back without losing history', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'Variables', exact: true }).click();
    await page.getByRole('tab', { name: 'Dimensions', exact: true }).click();
    await page.getByRole('button', { name: 'Edit dimension MediaSize', exact: true }).click();
    const minimum = page.getByLabel('Minimum screen width for lg', { exact: true });
    await minimum.fill('750');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.goBack();
    await expect(page).toHaveURL(/\/variables$/);
    await expect(minimum).toHaveValue('750');
    page.once('dialog', (dialog) => dialog.accept());
    await page.goBack();
    await expect(page.locator('svg#surface')).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/variables$/);
    await page.getByRole('tab', { name: 'Dimensions', exact: true }).click();
    await page.getByRole('button', { name: 'Edit dimension MediaSize', exact: true }).click();
    await expect(minimum).toHaveValue('600');
    await minimum.fill('720');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.goBack();
    await expect(page.locator('svg#surface')).toBeVisible();
});
