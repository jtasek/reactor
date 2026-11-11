import { expect, test, type Page } from '@playwright/test';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

async function click(page: Page, x: number, y: number) {
    await pointer(page, 'pointerdown', { x, y });
    await pointer(page, 'pointerup', { x, y });
}

const explorer = (page: Page) => page.getByRole('region', { name: 'Explorer' });
const row = (page: Page, name: string) => explorer(page).getByRole('button', { name, exact: true });
const rowItem = (page: Page, name: string) => row(page, name).locator('xpath=ancestor::li[1]');

async function openFilter(page: Page) {
    await explorer(page).getByRole('button', { name: 'Filter', exact: true }).click();

    return page.getByRole('menu', { name: 'Filter' });
}

test('one outline, with no view switch and creation in menus', async ({ page }) => {
    await openEditor(page, ['Explorer']);

    await expect(explorer(page).getByRole('button', { name: 'Layers', exact: true })).toHaveCount(
        0
    );
    await expect(explorer(page).getByRole('button', { name: 'Objects', exact: true })).toHaveCount(
        0
    );
    await expect(explorer(page).getByText('Draw a shape or add a screen to start.')).toBeVisible();

    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await expect(
        explorer(page)
            .getByRole('region', { name: 'Canvas' })
            .getByRole('button', { name: 'rectangle-1', exact: true })
    ).toBeVisible();

    // A row's right-click menu runs commands for its item.
    await row(page, 'rectangle-1').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Create component' }).click();
    await expect(
        explorer(page)
            .getByRole('region', { name: 'Components' })
            .getByRole('button', { name: 'component-1', exact: true })
    ).toBeVisible();

    // New layer lives in the filter menu.
    await (await openFilter(page)).getByRole('menuitem', { name: 'New layer' }).click();
    const filter = await openFilter(page);

    await expect(filter.getByRole('menuitemradio', { name: 'layer-1' })).toBeVisible();
});

test('a layer filter narrows the outline in place, and new shapes go onto that layer', async ({
    page
}) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await page.keyboard.press('ControlOrMeta+Alt+l');
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await click(page, 600, 400);

    const rows = explorer(page).getByRole('button', { name: /^rectangle-\d$/ });

    await expect(rows).toHaveCount(2);
    await (await openFilter(page)).getByRole('menuitemradio', { name: 'layer-1' }).click();
    await expect(explorer(page).getByText('Layer: layer-1')).toBeVisible();
    await expect(rows).toHaveText(['rectangle-1']);

    await drawRect(page, { x: 500, y: 100 }, { x: 540, y: 140 });
    await expect(rows).toHaveText(['rectangle-3', 'rectangle-1']);

    // Also after a row was pressed, which selects that shape and no layer.
    await row(page, 'rectangle-1').click();
    await drawRect(page, { x: 600, y: 100 }, { x: 640, y: 140 });
    await expect(rows).toHaveText(['rectangle-4', 'rectangle-3', 'rectangle-1']);

    // The pill names every filter that is on.
    await (await openFilter(page))
        .getByRole('menuitemradio', { name: /Hidden and locked/ })
        .click();
    await expect(explorer(page).getByText('Layer: layer-1 · Hidden and locked')).toBeVisible();
    await expect(rows).toHaveCount(0);

    await explorer(page).getByRole('button', { name: 'Clear filter' }).click();
    await expect(explorer(page).getByText('Layer: layer-1')).toHaveCount(0);
    await expect(rows).toHaveCount(4);
    await expect(shapes(page)).toHaveCount(4);
});

test('the Filter button opens its menu and closes it again', async ({ page }) => {
    await openEditor(page, ['Explorer']);
    const button = explorer(page).getByRole('button', { name: 'Filter', exact: true });
    const menu = page.getByRole('menu', { name: 'Filter' });

    await button.click();
    await expect(menu).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await button.click();
    await expect(menu).toHaveCount(0);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('Hidden and locked only keeps flagged items and what holds them', async ({ page }) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await click(page, 600, 400);

    await rowItem(page, 'rectangle-1').hover();
    await rowItem(page, 'rectangle-1').getByRole('button', { name: 'Lock', exact: true }).click();
    await (await openFilter(page))
        .getByRole('menuitemradio', { name: /Hidden and locked/ })
        .click();

    await expect(explorer(page).getByRole('button', { name: /^rectangle-\d$/ })).toHaveText([
        'rectangle-1'
    ]);
    await explorer(page).getByRole('button', { name: 'Clear filter' }).click();
    await expect(explorer(page).getByRole('button', { name: /^rectangle-\d$/ })).toHaveCount(2);
});

test('pressing the space under the outline selects the canvas', async ({ page }) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    const shape = row(page, 'rectangle-1');

    await shape.click();
    await expect(shape).toHaveAttribute('aria-pressed', 'true');

    const outline = explorer(page).locator('[data-explorer-outline]');
    const box = (await outline.boundingBox())!;

    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);
    await expect(shape).toHaveAttribute('aria-pressed', 'false');
});

test('layers are renamed, hidden and deleted in Manage layers; their shapes stay', async ({
    page
}) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await page.keyboard.press('ControlOrMeta+Alt+l');
    await (await openFilter(page)).getByRole('menuitem', { name: 'Manage layers…' }).click();

    const sheet = page.getByRole('dialog', { name: 'Layers' });
    const name = sheet.getByRole('textbox', { name: 'Name of layer-1' });

    await name.fill('Walls');
    await name.press('Enter');
    await expect(sheet.getByRole('textbox', { name: 'Name of Walls' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Hide Walls', exact: true }).click();
    await expect(sheet.getByRole('button', { name: 'Show Walls', exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Delete Walls', exact: true }).click();
    await expect(sheet.getByRole('textbox')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);

    await expect(row(page, 'rectangle-1')).toBeVisible();
    await expect(shapes(page)).toHaveCount(1);
});

test('the search box filters the outline by name, without running shortcuts', async ({ page }) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });

    const search = page.getByRole('searchbox', { name: 'Search' });
    const rows = explorer(page).getByRole('button', { name: /^rectangle-\d$/ });

    await expect(rows).toHaveCount(2);

    await search.fill('Rectangle-2');
    await expect(rows).toHaveText(['rectangle-2']);

    await search.fill('');
    await search.pressSequentially('door');
    await expect(rows).toHaveCount(0);
    await expect(explorer(page).getByText('No matches')).toBeVisible();
    await expect(explorer(page).getByRole('region', { name: 'Canvas' })).toHaveCount(0);
    await expect(shapes(page)).toHaveCount(2);

    // Escape clears the search.
    await search.press('Escape');
    await expect(search).toHaveValue('');
    await expect(rows).toHaveCount(2);
});

test('a group closes, opens while a search finds what it holds, and stays closed', async ({
    page
}) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await pointer(page, 'pointerdown', { x: 280, y: 80 });
    await pointer(page, 'pointermove', { x: 460, y: 160 });
    await pointer(page, 'pointerup', { x: 460, y: 160 });
    await page.keyboard.press('ControlOrMeta+g');
    await click(page, 600, 400);
    await drawRect(page, { x: 500, y: 300 }, { x: 540, y: 340 });

    const search = page.getByRole('searchbox', { name: 'Search' });

    await page.getByRole('button', { name: 'Collapse group-1', exact: true }).click();
    await expect(row(page, 'rectangle-1')).toHaveCount(0);
    await expect(row(page, 'rectangle-3')).toBeVisible();

    await search.fill('rectangle-1');
    await expect(row(page, 'rectangle-1')).toBeVisible();

    // A search that leaves the group out does not forget it was closed.
    await search.fill('rectangle-3');
    await expect(row(page, 'group-1')).toHaveCount(0);
    await search.fill('');
    await expect(row(page, 'group-1')).toBeVisible();
    await expect(row(page, 'rectangle-1')).toHaveCount(0);

    await page.getByRole('button', { name: 'Expand group-1', exact: true }).click();
    await expect(row(page, 'rectangle-1')).toBeVisible();
});

test('hide and lock show on hover beside the name, and stay while they are on', async ({
    page
}) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await click(page, 600, 400);

    const item = rowItem(page, 'rectangle-1');
    const name = row(page, 'rectangle-1');
    const hide = item.getByRole('button', { name: 'Hide', exact: true });
    const lock = item.getByRole('button', { name: 'Lock', exact: true });

    await page.mouse.move(700, 500);
    await expect(hide).toBeHidden();
    await item.hover();
    await expect(hide).toBeVisible();
    await expect(lock).toBeVisible();

    // The icons have their own space: the name ends before them.
    const nameBox = (await name.boundingBox())!;
    const hideBox = (await hide.boundingBox())!;

    expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(hideBox.x);

    await lock.click();
    await page.mouse.move(700, 500);
    await expect(item.getByRole('button', { name: 'Unlock', exact: true })).toBeVisible();
    await expect(hide).toBeHidden();

    // Everything else is in the row's menu.
    await name.click({ button: 'right' });
    const menu = page.getByRole('menu', { name: 'rectangle-1 actions' });

    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await rowItem(page, 'rectangle-2').getByRole('button', { name: 'rectangle-2' }).click({
        button: 'right'
    });
    await page
        .getByRole('menu', { name: 'rectangle-2 actions' })
        .getByRole('menuitem', { name: 'Clone' })
        .click();
    await expect(shapes(page)).toHaveCount(3);
});

test('the outline is a tree with one tab stop, arrow keys, rename and a menu key', async ({
    page
}) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await click(page, 600, 400);

    const tree = explorer(page).getByRole('tree', { name: 'Canvas' });
    const search = page.getByRole('searchbox', { name: 'Search' });

    await expect(tree.getByRole('treeitem')).toHaveCount(2);
    await search.focus();
    await page.keyboard.press('Tab');
    await expect(explorer(page).getByRole('button', { name: 'Filter' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(row(page, 'rectangle-2')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(row(page, 'rectangle-1')).not.toBeFocused();

    await row(page, 'rectangle-2').focus();
    await page.keyboard.press('ArrowDown');
    await expect(row(page, 'rectangle-1')).toBeFocused();
    await expect(row(page, 'rectangle-1')).toHaveAttribute('aria-pressed', 'true');
    await expect(rowItem(page, 'rectangle-1')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(row(page, 'rectangle-2')).toBeFocused();

    // Return renames; Escape leaves the name as it was.
    await page.keyboard.press('Enter');
    const field = explorer(page).getByRole('textbox', { name: 'Rename rectangle-2' });

    await expect(field).toBeFocused();
    await page.keyboard.type('Door');
    await page.keyboard.press('Escape');
    await expect(row(page, 'rectangle-2')).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.type('Door');
    await page.keyboard.press('Enter');
    await expect(row(page, 'Door')).toBeFocused();

    // Space hides, once however long it is held; Shift+F10 opens the row's menu, and
    // Escape comes back to the row.
    await page.keyboard.down(' ');
    await page.keyboard.down(' ');
    await page.keyboard.up(' ');
    await expect(rowItem(page, 'Door').getByRole('button', { name: 'Show' })).toBeVisible();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu', { name: 'Door actions' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: 'Door actions' })).toHaveCount(0);
    await expect(row(page, 'Door')).toBeFocused();
});
