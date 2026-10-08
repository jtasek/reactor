import { expect, test, type Locator, type Page } from '@playwright/test';
import { SCHEMA_VERSION, type PersistedState } from 'src/app/services/documentStorage';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

async function click(page: Page, x: number, y: number) {
    await pointer(page, 'pointerdown', { x, y });
    await pointer(page, 'pointerup', { x, y });
}

test('the explorer lists layers as a tree, shows one layer alone, and takes dropped shapes', async ({
    page
}) => {
    await openEditor(page, ['Explorer']);

    // Two squares, each moved to a layer of its own while it is the selection.
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await page.keyboard.press('ControlOrMeta+Alt+l');
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await click(page, 600, 400);
    await click(page, 420, 120);
    await page.keyboard.press('ControlOrMeta+Alt+l');
    await click(page, 600, 400);

    const first = page.getByRole('button', { name: 'layer-1', exact: true });
    const second = page.getByRole('button', { name: 'layer-2', exact: true });
    const shapesOn = (layer: Locator) =>
        layer.locator('xpath=ancestor::li[1]').getByRole('button', { name: /^rectangle-/ });

    await expect(shapesOn(first)).toHaveCount(1);
    await expect(shapesOn(second)).toHaveCount(1);

    // Pressing a layer's name shows only that layer; pressing it again shows all.
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(shapes(page)).toHaveCount(1);
    await first.click();
    await expect(shapes(page)).toHaveCount(2);

    // The layer's star does the same, and so does the Highlight layer command, by
    // its key, for the layer of the selected shape.
    const star = (name: string) =>
        first.locator('xpath=ancestor::li[1]').getByRole('button', { name, exact: true }).first();

    await star('Highlight layer').click();
    await expect(shapes(page)).toHaveCount(1);
    await star('Show all layers').click();
    await expect(shapes(page)).toHaveCount(2);

    await click(page, 420, 120);
    await page.keyboard.press('h');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(shapes(page)).toHaveCount(1);
    await page.keyboard.press('h');
    await expect(shapes(page)).toHaveCount(2);
    await click(page, 600, 400);

    // Dropping a shape on a layer moves it there; the layer left empty goes.
    await shapesOn(second).dragTo(first);
    await expect(shapesOn(first)).toHaveCount(2);
    await expect(second).toHaveCount(0);
});

test('the search box filters the explorer’s shapes by name, without running shortcuts', async ({
    page
}) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });

    const search = page.getByRole('searchbox', { name: 'Search shapes' });
    const rows = page.getByRole('region', { name: 'Explorer' }).getByRole('button', {
        name: /^rectangle-\d$/
    });

    await expect(rows).toHaveCount(2);

    await search.fill('Rectangle-2');
    await expect(rows).toHaveText(['rectangle-2']);

    await search.fill('');
    await search.pressSequentially('door');
    await expect(rows).toHaveCount(0);
    await expect(page.getByText('No shapes match')).toBeVisible();
    await expect(shapes(page)).toHaveCount(2);

    await search.fill('');
    await expect(rows).toHaveCount(2);
});

test('a layer collapses, and opens while a search finds what it holds', async ({ page }) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await page.keyboard.press('ControlOrMeta+Alt+l');
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });

    const row = (name: string) => page.getByRole('button', { name, exact: true });
    const search = page.getByRole('searchbox', { name: 'Search shapes' });

    await page.getByRole('button', { name: 'Collapse layer-1', exact: true }).click();
    await expect(row('rectangle-1')).toHaveCount(0);
    await expect(row('rectangle-2')).toBeVisible();

    await search.fill('rectangle-1');
    await expect(row('rectangle-1')).toBeVisible();

    await search.fill('');
    await expect(row('rectangle-1')).toHaveCount(0);

    // A search that leaves the layer out does not forget it was collapsed.
    await search.fill('rectangle-2');
    await expect(row('layer-1')).toHaveCount(0);
    await search.fill('');
    await expect(row('layer-1')).toBeVisible();
    await expect(row('rectangle-1')).toHaveCount(0);

    await page.getByRole('button', { name: 'Expand layer-1', exact: true }).click();
    await expect(row('rectangle-1')).toBeVisible();
});

test('an empty layer has nothing to collapse', async ({ page }) => {
    const metadata = {
        created: '2026-01-01T00:00:00.000Z',
        modified: '2026-01-01T00:00:00.000Z',
        createdBy: 'anonymous',
        modifiedBy: 'anonymous',
        locked: false
    };
    const saved: PersistedState = {
        version: SCHEMA_VERSION,
        currentDocumentId: 'document',
        documents: {
            document: {
                ...metadata,
                id: 'document',
                author: 'anonymous',
                name: 'Layered',
                tags: [],
                camera: { scale: 1, position: { x: 0, y: 0 } },
                grid: { width: 10, height: 10, factor: 10, visible: true },
                shapes: {
                    box: {
                        ...metadata,
                        id: 'box',
                        name: 'Box',
                        type: 'rectangle',
                        visible: true,
                        order: 'a0',
                        rotation: 0,
                        position: { x: 100, y: 100 },
                        size: { width: 50, height: 50 }
                    }
                },
                groups: {},
                layers: {
                    walls: {
                        id: 'walls',
                        name: 'Walls',
                        locked: false,
                        visible: true,
                        shapesIds: []
                    }
                },
                components: {},
                links: {},
                guides: {}
            }
        }
    };

    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Explorer']);

    await expect(page.getByRole('button', { name: 'Walls', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse Walls', exact: true })).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Collapse No layer', exact: true })
    ).toBeVisible();
});

test('an item’s menu fades in under the pointer and runs commands for that item', async ({
    page
}) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await click(page, 600, 400);

    const row = page.getByRole('button', { name: 'rectangle-1', exact: true }).locator('..');
    const menu = row.getByRole('toolbar', { name: 'rectangle-1 menu' });
    const button = (name: string) => menu.getByRole('button', { name, exact: true });

    await expect(button('Hide')).toHaveCSS('opacity', '0');
    await row.hover();
    await expect(button('Hide')).toHaveCSS('opacity', '1');

    // All six buttons are in the bar. Nothing is selected: a command runs for the
    // row's shape.
    await expect(button('More')).toHaveCount(0);
    await button('Clone').click();
    await expect(shapes(page)).toHaveCount(3);

    await button('Delete').click();
    await expect(shapes(page)).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'rectangle-1', exact: true })).toHaveCount(0);

    // A button switched on stays shown when the pointer leaves.
    const other = page.getByRole('button', { name: 'rectangle-2', exact: true }).locator('..');

    await other.hover();
    await other.getByRole('button', { name: 'Lock', exact: true }).click();
    await page.mouse.move(700, 500);
    await expect(other.getByRole('button', { name: 'Unlock', exact: true })).toHaveCSS(
        'opacity',
        '1'
    );
    await expect(other.getByRole('button', { name: 'Hide', exact: true })).toHaveCSS(
        'opacity',
        '0'
    );
    await expect(other.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
});
