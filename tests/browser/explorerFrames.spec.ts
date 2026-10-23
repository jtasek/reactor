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
            home: { ...box, id: 'home', name: 'Home' },
            card: { ...box, id: 'card', name: 'Card', parentFrameId: 'home' },
            settings: { ...box, id: 'settings', name: 'Settings' }
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

test('nests frame artwork once, keeps layer/group controls and sorts shapes by drawing order', async ({
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
    await page.screenshot({ path: '/tmp/reactor-explorer-frames-normal.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(name(page, 'Artwork')).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-explorer-frames-narrow.png' });
});

test('search reveals frame ancestry and matching frame contents without forgetting collapse state', async ({
    page
}) => {
    const search = page.getByRole('searchbox', { name: 'Search shapes' });

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

test('layer branches collapse independently and retain drag and inherited restriction behavior', async ({
    page
}) => {
    const home = branch(page, 'Home');
    const homeLayer = home.getByRole('button', { name: 'Shared layer', exact: true });
    const canvasLayer = branch(page, 'Canvas')
        .locator('> ul > li')
        .filter({ has: page.getByRole('button', { name: 'Loose', exact: true }) });

    await home.getByRole('button', { name: 'Collapse Shared layer', exact: true }).click();
    await expect(name(page, 'Title')).toHaveCount(0);
    await expect(name(page, 'Loose')).toBeVisible();
    await home.getByRole('button', { name: 'Expand Shared layer', exact: true }).click();
    await name(page, 'Loose').locator('..').locator('span[draggable]').dragTo(homeLayer);
    await expect(canvasLayer.getByRole('button', { name: 'Loose', exact: true })).toBeVisible();

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
