import { expect, test } from '@playwright/test';
import { drawRect, openEditor } from './support/editor';

test.beforeEach(async ({ page }) => {
    await openEditor(page, ['Explorer', 'Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    // Replaces the rectangle with an instance of a new component.
    await page.keyboard.press('ControlOrMeta+Alt+c');
});

test('double-clicking an instance narrows the Explorer to its component', async ({ page }) => {
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const instance = explorer
        .getByRole('region', { name: 'Canvas' })
        .getByRole('button', { name: /^component-1/ });

    await instance.dblclick();

    await expect(explorer.getByText('component-1', { exact: true })).toBeVisible();
    await expect(explorer.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
    await expect(
        explorer
            .getByRole('region', { name: 'Layers in component-1' })
            .getByRole('button', { name: 'rectangle-1' })
    ).toBeVisible();
    await expect(
        explorer.getByRole('region', { name: 'Used in' }).getByRole('treeitem', { name: 'Canvas' })
    ).toContainText('1');
    await expect(explorer.getByRole('region', { name: 'Canvas' })).toHaveCount(0);
    await expect(explorer.getByRole('region', { name: 'Components' })).toHaveCount(0);
    await expect(explorer.getByRole('searchbox')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Component editing' })).toBeVisible();

    // Picking a layer keeps the focus view.
    await explorer.getByRole('button', { name: 'rectangle-1' }).click();
    await expect(explorer.getByRole('button', { name: 'Done', exact: true })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(explorer.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Component editing' })).toHaveCount(0);
    await expect(instance).toHaveAttribute('aria-pressed', 'true');
});

test('Done and a "Used in" row go back to the whole outline', async ({ page }) => {
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const sources = explorer.getByRole('region', { name: 'Components' });
    const done = explorer.getByRole('button', { name: 'Done', exact: true });

    await sources.getByRole('button', { name: 'component-1', exact: true }).dblclick();
    // A double-click's second press lands on the new rows and does nothing there.
    await expect(done).toBeVisible();
    await done.click();
    await expect(sources).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Component editing' })).toHaveCount(0);

    await sources.getByRole('button', { name: 'component-1', exact: true }).dblclick();
    await expect(done).toBeVisible();
    await explorer
        .getByRole('region', { name: 'Used in' })
        .getByRole('button', { name: 'Canvas' })
        .click();
    await expect(page.getByRole('navigation', { name: 'Component editing' })).toHaveCount(0);
    await expect(
        explorer
            .getByRole('region', { name: 'Canvas' })
            .getByRole('button', { name: /^component-1/ })
    ).toHaveAttribute('aria-pressed', 'true');
});

test('the keyboard moves through the focus view and Return goes to a "Used in" place', async ({
    page
}) => {
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const instance = explorer
        .getByRole('region', { name: 'Canvas' })
        .getByRole('button', { name: /^component-1/ });
    const navigation = page.getByRole('navigation', { name: 'Component editing' });

    await instance.dblclick();
    const layer = explorer
        .getByRole('region', { name: 'Layers in component-1' })
        .getByRole('button', { name: 'rectangle-1' });
    const canvas = explorer
        .getByRole('region', { name: 'Used in' })
        .getByRole('button', { name: 'Canvas' });

    await layer.click();
    // One tab stop for the whole list, as in the whole outline.
    await expect(explorer.locator('[data-explorer-row][tabindex="0"]')).toHaveCount(1);
    await expect(layer).toHaveAttribute('tabindex', '0');

    // Moving onto a "Used in" row doesn't press it.
    await layer.press('ArrowDown');
    await expect(canvas).toBeFocused();
    await expect(navigation).toBeVisible();

    await canvas.press('Enter');
    await expect(navigation).toHaveCount(0);
    await expect(instance).toHaveAttribute('aria-pressed', 'true');
    await expect(instance).toBeFocused();
});
