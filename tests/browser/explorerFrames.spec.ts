import { expect, test, type Page } from '@playwright/test';
import { createDocument, createGroup, createLayer, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

const explorer = (page: Page) => page.getByRole('region', { name: 'Explorer' });
const name = (page: Page, text: string) =>
    explorer(page).getByRole('button', { name: text, exact: true });
const branch = (page: Page, text: string) => name(page, text).locator('xpath=ancestor::li[1]');

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
    await openEditor(page, ['Explorer', 'Inspector']);
});

test('nests frame artwork once, keeps group controls and sorts shapes by drawing order', async ({
    page
}) => {
    const home = branch(page, 'Home');
    const card = branch(page, 'Card');

    await expect(home.getByRole('button', { name: 'Card', exact: true })).toBeVisible();
    await expect(home.getByRole('button', { name: 'Title', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Art group', exact: true })).toBeVisible();
    await expect(
        branch(page, 'Art group').getByRole('button', { name: /^(Button|Artwork)$/ })
    ).toHaveText(['Button', 'Artwork']);

    for (const text of ['Title', 'Artwork', 'Button', 'Loose']) {
        await expect(name(page, text)).toHaveCount(1);
    }

    await expect(home.getByRole('button', { name: 'Loose', exact: true })).toHaveCount(0);
    await expect(branch(page, 'Canvas').locator('> ul > li').last()).toContainText('Loose');
    await name(page, 'Artwork').click();
    await expect(name(page, 'Artwork')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Selection parent', { exact: true })).toHaveValue('card');

    await name(page, 'Artwork').focus();
    await page.keyboard.press('Tab');
    await expect(
        name(page, 'Artwork').locator('..').getByRole('button', { name: 'Hide', exact: true })
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(name(page, 'Artwork')).toBeFocused();
    await page.screenshot({ path: '/tmp/reactor-explorer-objects-normal.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(name(page, 'Artwork')).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-explorer-objects-narrow.png' });
});

test('search reveals frame ancestry and matching frame contents without forgetting collapse state', async ({
    page
}) => {
    const search = page.getByRole('searchbox', { name: 'Search objects' });

    await explorer(page).getByRole('button', { name: 'Collapse Home', exact: true }).click();
    await expect(name(page, 'Artwork')).toHaveCount(0);
    await search.fill('Artwork');
    await expect(name(page, 'Home')).toBeVisible();
    await expect(name(page, 'Card')).toBeVisible();
    await expect(name(page, 'Art group')).toBeVisible();
    await expect(name(page, 'Artwork')).toBeVisible();
    await expect(name(page, 'Button')).toHaveCount(0);
    await expect(name(page, 'Title')).toHaveCount(0);
    await expect(name(page, 'Loose')).toHaveCount(0);
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
    await explorer(page).getByRole('button', { name: 'Expand Home', exact: true }).click();
    await expect(name(page, 'Artwork')).toBeVisible();
});

test('updates frame branches after reparenting, reload, boundary deletion and undo', async ({
    page
}) => {
    await name(page, 'Title').click();
    await page.getByLabel('Selection parent', { exact: true }).selectOption('card');
    await expect(
        branch(page, 'Card').getByRole('button', { name: 'Title', exact: true })
    ).toBeVisible();
    await expect(name(page, 'Title')).toHaveCount(1);
    await page.reload();
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

test('global layers stay whole and preserve selection and collapse state across views', async ({
    page
}) => {
    await expect(name(page, 'Shared layer')).toHaveCount(0);
    await expect(name(page, 'New layer')).toHaveCount(0);
    await expect(name(page, 'Home')).toHaveAccessibleDescription('Screen');
    await expect(name(page, 'Settings')).toHaveAccessibleDescription('Screen');
    await expect(name(page, 'Card')).not.toHaveAttribute('aria-describedby');
    await name(page, 'Title').click();
    await name(page, 'Collapse Home').click();
    await name(page, 'Layers').click();
    await expect(name(page, 'Layers')).toHaveAttribute('aria-pressed', 'true');
    await expect(name(page, 'Shared layer')).toHaveCount(1);
    await expect(name(page, 'Home')).toHaveCount(0);
    await expect(name(page, 'Title')).toHaveAttribute('aria-pressed', 'true');
    await expect(
        branch(page, 'Shared layer').getByRole('button', { name: /^(Title|Loose)$/ })
    ).toHaveText(['Loose', 'Title']);
    await expect(
        explorer(page).getByText('Global layers organize objects across all screens.')
    ).toBeVisible();

    const layerRow = name(page, 'Shared layer').locator('..');

    await layerRow.hover();
    await layerRow.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(page.locator('svg#surface rect[data-cy="Title"]')).toHaveCount(0);
    await expect(page.locator('svg#surface rect[data-cy="Loose"]')).toHaveCount(0);
    await layerRow.hover();
    await layerRow.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(page.locator('svg#surface rect[data-cy="Title"]')).toBeVisible();
    await expect(page.locator('svg#surface rect[data-cy="Loose"]')).toBeVisible();
    await name(page, 'Loose')
        .locator('..')
        .locator('span[draggable]')
        .dragTo(name(page, 'No layer'));
    await expect(
        branch(page, 'Shared layer').getByRole('button', { name: 'Loose', exact: true })
    ).toHaveCount(0);
    await name(page, 'Loose')
        .locator('..')
        .locator('span[draggable]')
        .dragTo(name(page, 'Shared layer'));
    await expect(
        branch(page, 'Shared layer').getByRole('button', { name: 'Loose', exact: true })
    ).toBeVisible();
    await page.mouse.move(700, 500);
    await page.screenshot({ path: '/tmp/reactor-explorer-layers-normal.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(name(page, 'Shared layer')).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-explorer-layers-narrow.png' });
    await name(page, 'Collapse Shared layer').click();
    await name(page, 'Objects').click();
    await expect(name(page, 'Title')).toHaveCount(0);
    await name(page, 'Expand Home').click();
    await expect(name(page, 'Title')).toBeVisible();
    await expect(
        branch(page, 'Home').getByRole('button', { name: 'Loose', exact: true })
    ).toHaveCount(0);
    await name(page, 'Layers').click();
    await expect(name(page, 'Title')).toHaveCount(0);
    await name(page, 'Objects').click();
    await expect(name(page, 'Title')).toBeVisible();
});

test('object grouping retains inherited restrictions', async ({ page }) => {
    // Existing group drops set both group and parent membership.
    await name(page, 'Loose')
        .locator('..')
        .locator('span[draggable]')
        .dragTo(name(page, 'Art group'));
    await expect(
        branch(page, 'Art group').getByRole('button', { name: 'Loose', exact: true })
    ).toBeVisible();
    await expect(name(page, 'Loose')).toHaveCount(1);
    const homeRow = name(page, 'Home').locator('..');

    await homeRow.hover();
    await homeRow.getByRole('button', { name: 'Lock', exact: true }).click();
    await name(page, 'Artwork').click();
    await expect(page.getByLabel('Selection parent', { exact: true })).toBeDisabled();
    await name(page, 'Artwork').locator('..').hover();
    await expect(
        name(page, 'Artwork').locator('..').getByRole('button', { name: 'Hide', exact: true })
    ).toBeDisabled();
    await homeRow.hover();
    await homeRow.getByRole('button', { name: 'Unlock', exact: true }).click();
    await homeRow.hover();
    await homeRow.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(name(page, 'Artwork')).toBeVisible();
    await expect(page.locator('svg#surface rect[data-cy="Artwork"]')).toHaveCount(0);
    await homeRow.hover();
    await homeRow.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(page.locator('svg#surface rect[data-cy="Artwork"]')).toBeVisible();
});

test('screen identity is explicit and search is scoped to each view', async ({ page }) => {
    await name(page, 'Card').click();
    await page.getByLabel('Frame parent', { exact: true }).selectOption('');
    await expect(name(page, 'Card')).not.toHaveAttribute('aria-describedby');
    await page.getByLabel('Frame type', { exact: true }).selectOption('screen');
    await expect(name(page, 'Card')).toHaveAccessibleDescription('Screen');
    await page.getByLabel('Frame parent', { exact: true }).selectOption('home');
    await expect(name(page, 'Card')).toHaveAccessibleDescription('Screen');
    await expect(page.getByText('Move this screen to Canvas', { exact: false })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search objects', exact: true }).fill('Shared layer');
    await expect(explorer(page).getByText('No objects match')).toBeVisible();
    await name(page, 'Layers').click();
    await expect(name(page, 'Shared layer')).toBeVisible();
    await expect(name(page, 'Title')).toBeVisible();
    await page
        .getByRole('searchbox', { name: 'Search layers and objects' })
        .fill('nothing matches');
    await expect(explorer(page).getByText('No layers or objects match')).toBeVisible();
});
