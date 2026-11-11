import { expect, test, type Page } from '@playwright/test';
import { createDocument, createGroup, createLayer, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor, pointer } from './support/editor';

const explorer = (page: Page) => page.getByRole('region', { name: 'Explorer' });
const name = (page: Page, text: string) =>
    explorer(page).getByRole('button', { name: text, exact: true });
const viewName = (text: string) => `${text} · 500 px`;
const branch = (page: Page, text: string) => name(page, text).locator('xpath=ancestor::li[1]');
const row = (page: Page, text: string) => name(page, text).locator('..');
/** Screens start closed, apart from the one selected or edited. */
const expand = (page: Page, text: string) =>
    explorer(page)
        .getByRole('button', { name: `Expand ${text}`, exact: true })
        .click();

test.beforeEach(async ({ page }) => {
    const box = {
        visible: true,
        locked: false,
        position: { x: 150, y: 120 },
        size: { width: 500, height: 400 }
    };
    const shapes = Object.fromEntries(
        [
            { id: 'title', name: 'Title', parentFrameId: 'home', order: 'a0' },
            { id: 'artwork', name: 'Artwork', parentFrameId: 'card', order: 'a1' },
            { id: 'button', name: 'Button', parentFrameId: 'card', order: 'a2' },
            { id: 'loose', name: 'Loose', order: 'a3' }
        ].map((options, index) => [
            options.id,
            {
                ...createShape({
                    ...options,
                    type: 'rectangle',
                    position: { x: 200 + index * 80, y: 200 },
                    size: { width: 50, height: 40 }
                }),
                id: options.id
            }
        ])
    );
    const document = createDocument({
        frames: {
            home: { ...box, id: 'home', name: 'Home', kind: 'screen' },
            card: { ...box, id: 'card', name: 'Card', parentFrameId: 'home' },
            settings: { ...box, id: 'settings', name: 'Settings', kind: 'screen' }
        },
        shapes,
        groups: {
            art: createGroup({ id: 'art', name: 'Art group', shapesIds: ['artwork', 'button'] })
        },
        layers: {
            shared: createLayer({
                id: 'shared',
                name: 'Shared layer',
                shapesIds: ['title', 'loose']
            })
        }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });

    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Explorer', 'Inspector'], { closedExplorer: true });
});

test('nests frame artwork once under its screen, and sorts shapes by drawing order', async ({
    page
}) => {
    await expect(name(page, 'Title')).toHaveCount(0);
    await expand(page, 'Home');
    const home = branch(page, 'Home');
    const card = branch(page, 'Card');

    await expect(home.getByRole('button', { name: 'Card', exact: true })).toBeVisible();
    await expect(home.getByRole('button', { name: 'Title', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Art group', exact: true })).toBeVisible();
    await expect(
        branch(page, 'Art group').getByRole('button', { name: /^(Button|Artwork)$/ })
    ).toHaveText(['Button', 'Artwork']);

    for (const text of ['Home', 'Settings', 'Title', 'Artwork', 'Button', 'Loose']) {
        await expect(name(page, text)).toHaveCount(1);
    }

    await expect(home.getByRole('button', { name: 'Loose', exact: true })).toHaveCount(0);
    await expect(
        explorer(page).getByRole('tree', { name: 'Canvas' }).getByRole('treeitem').last()
    ).toContainText('Loose');
    await name(page, 'Artwork').click();
    await expect(name(page, 'Artwork')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Selection parent', { exact: true })).toHaveValue('card');
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(name(page, 'Artwork')).toBeVisible();
});

test('each screen is listed once, with its views as chips', async ({ page }) => {
    for (const text of ['Home', 'Settings']) {
        await expect(name(page, text).locator('svg.lucide-app-window')).toHaveCount(1);
        await expect(name(page, text).locator('svg.lucide-frame')).toHaveCount(0);
        await expect(name(page, viewName(text))).toHaveText('500 px');
    }

    await expect(explorer(page).getByRole('region', { name: 'Screens' })).toBeVisible();
    await expect(explorer(page).getByText('Screen view', { exact: true })).toHaveCount(0);

    await name(page, viewName('Home')).click();
    await expect(name(page, viewName('Home'))).toHaveAttribute('aria-pressed', 'true');
    await expect(name(page, 'Home')).toHaveAttribute('aria-pressed', 'false');

    // Choosing a view opens its screen.
    await expect(name(page, 'Card').locator('svg.lucide-frame')).toHaveCount(1);
    await expect(name(page, 'Card').locator('svg.lucide-app-window')).toHaveCount(0);
});

test('selecting on the canvas opens the rows that hold the selection', async ({ page }) => {
    await expect(name(page, 'Artwork')).toHaveCount(0);
    await expect(name(page, 'Title')).toHaveCount(0);
    // Artwork sits in Art group, in Card, inside Home: pressing it opens those rows.
    // The Explorer floats over the view, so the press goes to the shape itself.
    const surface = (await page.locator('svg#surface').boundingBox())!;
    const press = async (shape: string) => {
        const target = `#screen-views [data-cy="${shape}"]`;
        const box = (await page.locator(`svg#surface ${target}`).first().boundingBox())!;
        const at = {
            target,
            x: box.x - surface.x + box.width / 2,
            y: box.y - surface.y + box.height / 2
        };

        await pointer(page, 'pointerdown', at);
        await pointer(page, 'pointerup', at);
    };

    await press('Artwork');
    await expect(name(page, 'Art group')).toHaveAttribute('aria-pressed', 'true');
    await expect(name(page, 'Artwork')).toBeVisible();
    await expect(name(page, 'Title')).toBeVisible();

    // A row closed by hand opens again for the next selection inside it.
    await explorer(page).getByRole('button', { name: 'Collapse Home', exact: true }).click();
    await expect(name(page, 'Title')).toHaveCount(0);
    await press('Title');
    await expect(name(page, 'Title')).toHaveAttribute('aria-pressed', 'true');
});

test('Rename is offered only where the name can change', async ({ page }) => {
    await expand(page, 'Home');
    await name(page, 'Title').focus();
    await page.keyboard.press('F2');
    await expect(explorer(page).getByRole('textbox', { name: 'Rename Title' })).toBeVisible();
    await page.keyboard.press('Escape');

    await row(page, 'Home').hover();
    await row(page, 'Home').getByRole('button', { name: 'Lock', exact: true }).click();
    for (const text of ['Home', 'Card', 'Art group', 'Title']) {
        await name(page, text).focus();
        await page.keyboard.press('F2');
        await expect(explorer(page).getByRole('textbox')).toHaveCount(0);
        await name(page, text).click({ button: 'right' });
        await expect(page.getByRole('menu', { name: `${text} actions` })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: 'Rename', exact: true })).toHaveCount(0);
        await page.keyboard.press('Escape');
    }
});

test('search reveals frame ancestry and matching frame contents without forgetting closed rows', async ({
    page
}) => {
    const search = page.getByRole('searchbox', { name: 'Search' });

    await expect(name(page, 'Artwork')).toHaveCount(0);
    await search.fill('Artwork');
    await expect(name(page, 'Home')).toBeVisible();
    await expect(name(page, 'Card')).toBeVisible();
    await expect(name(page, 'Art group')).toBeVisible();
    await expect(name(page, 'Artwork')).toBeVisible();
    await expect(name(page, 'Button')).toHaveCount(0);
    await expect(name(page, 'Title')).toHaveCount(0);
    await expect(name(page, 'Loose')).toHaveCount(0);
    await expect(name(page, 'Settings')).toHaveCount(0);
    await search.fill('Home');
    await expect(name(page, 'Title')).toBeVisible();
    await expect(name(page, 'Button')).toBeVisible();
    await expect(name(page, 'Settings')).toHaveCount(0);
    await search.fill('Settings');
    await expect(name(page, 'Settings')).toBeVisible();
    await expect(name(page, 'Home')).toHaveCount(0);
    await search.fill('');
    await expect(name(page, 'Home')).toBeVisible();
    await expect(name(page, 'Artwork')).toHaveCount(0);
    await expand(page, 'Home');
    await expect(name(page, 'Artwork')).toBeVisible();
});

test('updates frame branches after reparenting, reload, boundary deletion and undo', async ({
    page
}) => {
    await expand(page, 'Home');
    await name(page, 'Title').click();
    await page.getByLabel('Selection parent', { exact: true }).selectOption('card');
    await expect(
        branch(page, 'Card').getByRole('button', { name: 'Title', exact: true })
    ).toBeVisible();
    await expect(name(page, 'Title')).toHaveCount(1);
    await page.reload();
    // Open rows are kept on this device.
    await expect(
        branch(page, 'Card').getByRole('button', { name: 'Title', exact: true })
    ).toBeVisible();
    await name(page, 'Card').click();
    await page.keyboard.press('Delete');
    await expect(name(page, 'Card')).toHaveCount(0);
    await expect(
        branch(page, 'Home').getByRole('button', { name: 'Artwork', exact: true })
    ).toHaveCount(0);
    await expect(name(page, 'Artwork')).toBeVisible();
    await expect(name(page, 'Title')).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(
        branch(page, 'Card').getByRole('button', { name: 'Artwork', exact: true })
    ).toBeVisible();
    await expect(
        branch(page, 'Card').getByRole('button', { name: 'Title', exact: true })
    ).toBeVisible();
});

test('a layer filter keeps every object under its screen, and layers are managed in a sheet', async ({
    page
}) => {
    await expect(name(page, 'Shared layer')).toHaveCount(0);
    await explorer(page).getByRole('button', { name: 'Filter', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Shared layer' }).click();

    await expect(explorer(page).getByText('Layer: Shared layer')).toBeVisible();
    await expect(branch(page, 'Home').getByRole('button', { name: 'Title' })).toBeVisible();
    await expect(name(page, 'Loose')).toBeVisible();
    await expect(name(page, 'Artwork')).toHaveCount(0);
    await expect(name(page, 'Card')).toHaveCount(0);
    await expect(name(page, 'Settings')).toHaveCount(0);

    // Move to layer, from a row's menu.
    await name(page, 'Loose').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'No layer' }).click();
    await expect(name(page, 'Loose')).toHaveCount(0);
    await explorer(page).getByRole('button', { name: 'Clear filter' }).click();
    await expect(name(page, 'Loose')).toBeVisible();

    await explorer(page).getByRole('button', { name: 'Filter', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Manage layers…' }).click();
    const sheet = page.getByRole('dialog', { name: 'Layers' });

    await sheet.getByRole('button', { name: 'Hide Shared layer', exact: true }).click();
    await expect(page.locator('svg#surface #screen-views rect[data-cy="Title"]')).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Show Shared layer', exact: true }).click();
    await expect(page.locator('svg#surface #screen-views rect[data-cy="Title"]')).toBeVisible();
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet).toHaveCount(0);
});

test('object grouping retains inherited restrictions', async ({ page }) => {
    await expand(page, 'Home');
    // Existing group drops set both group and parent membership.
    await row(page, 'Loose').dragTo(name(page, 'Art group'));
    await expect(
        branch(page, 'Art group').getByRole('button', { name: 'Loose', exact: true })
    ).toBeVisible();
    await expect(name(page, 'Loose')).toHaveCount(1);
    const homeRow = row(page, 'Home');

    await homeRow.hover();
    await homeRow.getByRole('button', { name: 'Lock', exact: true }).click();
    await name(page, 'Artwork').click();
    await expect(page.getByLabel('Selection parent', { exact: true })).toBeDisabled();
    // Inherited state shows on the frame that sets it, not on every row inside.
    await row(page, 'Artwork').hover();
    await expect(row(page, 'Artwork').getByRole('button', { name: 'Hide' })).toHaveCount(0);
    await expect(homeRow.getByRole('button', { name: 'Unlock', exact: true })).toBeVisible();
    await homeRow.hover();
    await homeRow.getByRole('button', { name: 'Unlock', exact: true }).click();
    await homeRow.hover();
    await homeRow.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(name(page, 'Artwork')).toBeVisible();
    await expect(page.locator('svg#surface #screen-views rect[data-cy="Artwork"]')).toHaveCount(0);
    await homeRow.hover();
    await homeRow.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(page.locator('svg#surface #screen-views rect[data-cy="Artwork"]')).toBeVisible();
});

test('screen identity is explicit, and a nested screen stays in its parent', async ({ page }) => {
    await expand(page, 'Home');
    await name(page, 'Card').click();
    await page.getByLabel('Frame parent', { exact: true }).selectOption('');
    await expect(name(page, 'Card').locator('svg.lucide-frame')).toHaveCount(1);
    await page.getByLabel('Frame type', { exact: true }).selectOption('screen');
    await expect(
        explorer(page).getByRole('region', { name: 'Screens' }).getByRole('button', {
            name: 'Card',
            exact: true
        })
    ).toBeVisible();
    await name(page, 'Card').click();
    await page.getByLabel('Frame parent', { exact: true }).selectOption('home');
    // A nested screen is drawn inside its parent again, so it is listed there once.
    await expect(name(page, 'Card')).toHaveCount(1);
    await expect(
        branch(page, 'Home').getByRole('button', { name: 'Card', exact: true })
    ).toBeVisible();
    await expect(page.getByText('Move this screen to Canvas', { exact: false })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Shared layer');
    await expect(explorer(page).getByText('No matches')).toBeVisible();
});

test('dropping on a screen, frame or the Canvas title moves objects in and out', async ({
    page
}) => {
    await expand(page, 'Home');
    await row(page, 'Loose').dragTo(name(page, 'Settings'));
    await expect(
        branch(page, 'Settings').getByRole('button', { name: 'Loose', exact: true })
    ).toBeVisible();
    await name(page, 'Loose').click();
    await expect(page.getByLabel('Selection parent', { exact: true })).toHaveValue('settings');

    // A group moves whole, as with the Parent picker.
    await row(page, 'Art group').dragTo(name(page, 'Settings'));
    await expect(
        branch(page, 'Settings').getByRole('button', { name: 'Art group', exact: true })
    ).toBeVisible();
    await expect(name(page, 'Artwork')).toHaveCount(1);

    await row(page, 'Loose').dragTo(name(page, 'Card'));
    await expect(
        branch(page, 'Card').getByRole('button', { name: 'Loose', exact: true })
    ).toBeVisible();
    // The space under the outline is Canvas, also while no Canvas title shows.
    await row(page, 'Loose').dragTo(explorer(page).locator('[data-explorer-outline] > div').last());
    await expect(
        explorer(page).getByRole('tree', { name: 'Canvas' }).getByRole('button', { name: 'Loose' })
    ).toBeVisible();
    await name(page, 'Loose').click();
    await expect(page.getByLabel('Selection parent', { exact: true })).toHaveValue('');

    // A locked screen takes nothing.
    const homeRow = row(page, 'Home');

    await homeRow.hover();
    await homeRow.getByRole('button', { name: 'Lock', exact: true }).click();
    await row(page, 'Loose').dragTo(name(page, 'Home'));
    await expect(
        branch(page, 'Home').getByRole('button', { name: 'Loose', exact: true })
    ).toHaveCount(0);
    await expect(name(page, 'Loose')).toHaveCount(1);
});

test('open rows survive closing the panel and reloading', async ({ page }) => {
    await expand(page, 'Home');
    await expect(name(page, 'Title')).toBeVisible();
    const toggle = page.getByRole('checkbox', { name: 'Explorer', exact: true });

    await toggle.uncheck();
    await toggle.check();
    await expect(name(page, 'Title')).toBeVisible();
    await page.reload();
    await expect(name(page, 'Title')).toBeVisible();
    await explorer(page).getByRole('button', { name: 'Collapse Home', exact: true }).click();
    await page.reload();
    await expect(name(page, 'Home')).toBeVisible();
    await expect(name(page, 'Title')).toHaveCount(0);
});
