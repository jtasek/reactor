import { expect, test, type Page } from '@playwright/test';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';
import type { Frame } from 'src/app/types';

async function openModes(page: Page, missing = false) {
    const leaf = createShape({
        id: 'leaf',
        type: 'rectangle',
        name: 'Leaf artwork',
        order: 'a0',
        position: { x: 10, y: 10 },
        size: { width: 40, height: 40 },
        fill: '#112233',
        bindings: { fill: 'alias' }
    });
    const nested = createShape({
        id: 'nested',
        type: 'instance',
        name: 'Nested instance',
        order: 'a1',
        componentId: 'leaf-component',
        position: { x: 10, y: 10 },
        overrides: {}
    });
    const instance = createShape({
        id: 'instance',
        type: 'instance',
        name: 'Card instance',
        order: 'a2',
        componentId: 'card',
        position: { x: 220, y: 120 },
        overrides: {},
        parentFrameId: 'content'
    });
    const body = createShape({
        id: 'body',
        type: 'rectangle',
        name: 'Body',
        order: 'a3',
        position: { x: 130, y: 120 },
        size: { width: 40, height: 40 },
        fill: '#112233',
        bindings: { fill: 'alias' },
        parentFrameId: 'content'
    });
    leaf.id = 'leaf';
    nested.id = 'nested';
    instance.id = 'instance';
    body.id = 'body';
    const frame = (
        id: string,
        name: string,
        position: Frame['position'],
        size: Frame['size']
    ): Frame => ({
        id,
        kind: 'frame',
        name,
        position,
        size,
        visible: true,
        locked: false
    });
    const document = createDocument({
        id: 'mode-screens',
        name: 'Mode screens',
        dimensions: {
            palette: {
                id: 'palette',
                name: 'Palette',
                order: 0,
                defaultModeId: 'day',
                modes: {
                    day: { id: 'day', name: 'Day', order: 0 },
                    night: { id: 'night', name: 'Night', order: 1 }
                }
            },
            brand: {
                id: 'brand',
                name: 'Brand',
                order: 1,
                defaultModeId: 'main',
                modes: {
                    main: { id: 'main', name: 'Main', order: 0 },
                    accent: { id: 'accent', name: 'Accent', order: 1 }
                }
            }
        },
        variables: {
            ink: {
                id: 'ink',
                name: 'Ink',
                type: 'color',
                dimensionId: 'palette',
                values: { default: '#112233', night: '#ddeeff' }
            },
            alias: {
                id: 'alias',
                name: 'Surface',
                type: 'color',
                alias: 'ink',
                values: { default: '#000000' }
            }
        },
        shapes: { leaf, nested, instance, body },
        components: {
            'leaf-component': createComponent({
                id: 'leaf-component',
                name: 'Leaf',
                sourceOnly: true,
                shapesIds: ['leaf']
            }),
            card: createComponent({
                id: 'card',
                name: 'Card',
                sourceOnly: true,
                shapesIds: ['nested']
            })
        },
        frames: {
            home: {
                ...frame('home', 'Home', { x: 100, y: 80 }, { width: 300, height: 200 }),
                kind: 'screen',
                definitionOnly: true
            },
            mobile: {
                ...frame('mobile', 'Mobile', { x: 100, y: 80 }, { width: 300, height: 200 }),
                kind: 'view',
                screenId: 'home'
            },
            desktop: {
                ...frame('desktop', 'Desktop', { x: 500, y: 300 }, { width: 500, height: 250 }),
                kind: 'view',
                screenId: 'home',
                modeOverrides: missing
                    ? { palette: 'removed', ghost: 'gone' }
                    : { palette: 'night' }
            },
            content: {
                ...frame('content', 'Content', { x: 120, y: 100 }, { width: 200, height: 150 }),
                parentFrameId: 'home'
            }
        }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector', 'Explorer']);
    await page.getByRole('button', { name: 'More panels' }).click();
    const mobile = page.locator('#screen-views > [data-screen-view="mobile"]');
    const desktop = page.locator('#screen-views > [data-screen-view="desktop"]');
    const inspector = page.locator('[data-panel="inspector"]');
    const explorer = page.getByRole('region', { name: 'Explorer' });

    return { mobile, desktop, inspector, explorer };
}

const selectView = (page: Page, id: string) =>
    page.locator(`#frames > [data-frame="${id}"]`).press('Enter');

test('shows two palettes at once, keeps explicit choices ahead of local simulation and displays their source', async ({
    page
}) => {
    const { mobile, desktop, inspector } = await openModes(page);
    await expect(mobile.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(17, 34, 51)');
    await expect(desktop.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(221, 238, 255)');
    await expect(desktop.locator('[data-cy="Leaf artwork"]')).toHaveCSS(
        'fill',
        'rgb(221, 238, 255)'
    );
    const before = await desktop.locator('[data-cy="Body"]').boundingBox();
    await selectView(page, 'desktop');
    await inspector.getByLabel('Palette mode', { exact: true }).selectOption('day');
    await expect(inspector).toContainText('Day · View Home · Desktop');
    await page.getByRole('button', { name: 'More panels' }).click();
    await page.getByRole('checkbox', { name: 'Variables', exact: true }).check();
    await page.getByRole('button', { name: 'More panels' }).click();
    await page.getByLabel('Preview Palette', { exact: true }).selectOption('night');
    await expect(mobile.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(221, 238, 255)');
    await expect(desktop.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(17, 34, 51)');
    expect(await desktop.locator('[data-cy="Body"]').boundingBox()).toEqual(before);
    await expect(inspector.getByLabel('Brand mode', { exact: true })).toHaveValue('');
});

test('inherits screen and frame modes, overrides nested component color and resets each dimension independently', async ({
    page
}) => {
    const { mobile, desktop, inspector, explorer } = await openModes(page);
    await explorer.getByRole('button', { name: 'Home', exact: true }).click();
    await inspector.getByLabel('Palette mode', { exact: true }).selectOption('night');
    await expect(mobile.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(221, 238, 255)');
    const branch = explorer
        .getByRole('button', { name: 'Home · Desktop', exact: true })
        .locator('xpath=ancestor::li[1]');
    await branch.getByRole('button', { name: 'Content', exact: true }).click();
    await inspector.getByLabel('Palette mode', { exact: true }).selectOption('day');
    await inspector.getByLabel('Brand mode', { exact: true }).selectOption('accent');
    await expect(desktop.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(17, 34, 51)');
    await branch.getByRole('button', { name: 'Card instance', exact: true }).click();
    await inspector.getByLabel('Palette mode', { exact: true }).selectOption('night');
    await expect(inspector).toContainText('Night · Instance Card instance');
    await expect(desktop.locator('[data-cy="Leaf artwork"]')).toHaveCSS(
        'fill',
        'rgb(221, 238, 255)'
    );
    await expect(desktop.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(17, 34, 51)');
    await inspector.getByLabel('Palette mode', { exact: true }).selectOption('');
    await expect(desktop.locator('[data-cy="Leaf artwork"]')).toHaveCSS('fill', 'rgb(17, 34, 51)');
    await expect(inspector).toContainText('Day · Frame Content');
    await expect(inspector).toContainText('Accent · Frame Content');
    await page.screenshot({ path: 'test-results/reactor-inherited-modes.png' });
});

test('persists authored view choices with undo, redo and usable narrow controls', async ({
    page
}) => {
    const { desktop, inspector } = await openModes(page);
    await selectView(page, 'desktop');
    await inspector.getByLabel('Palette mode', { exact: true }).selectOption('day');
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await page.keyboard.press('ControlOrMeta+z');
    await expect(desktop.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(221, 238, 255)');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(desktop.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(17, 34, 51)');
    await page.reload();
    await selectView(page, 'desktop');
    await expect(inspector.getByLabel('Palette mode', { exact: true })).toHaveValue('day');
    await page.setViewportSize({ width: 600, height: 850 });
    await selectView(page, 'mobile');
    await inspector.getByLabel('Palette mode', { exact: true }).selectOption('night');
    await expect(inspector).toContainText('Night · View Home · Mobile');
    await page.screenshot({ path: 'test-results/reactor-inherited-modes-narrow.png' });
});

test('retains missing choices on reload, explains the fallback and allows Inherit to recover', async ({
    page
}) => {
    const { desktop, inspector } = await openModes(page, true);
    await selectView(page, 'desktop');
    await expect(inspector.getByLabel('Palette mode', { exact: true })).toHaveValue('removed');
    await expect(inspector).toContainText('mode removed is unavailable; using Day');
    await expect(desktop.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(17, 34, 51)');
    await page.reload();
    await selectView(page, 'desktop');
    await expect(inspector.getByLabel('Palette mode', { exact: true })).toHaveValue('removed');
    await inspector.getByLabel('Palette mode', { exact: true }).selectOption('');
    await inspector.getByLabel('Missing dimension ghost mode', { exact: true }).selectOption('');
    await expect(inspector.getByLabel('Missing dimension ghost mode', { exact: true })).toHaveCount(
        0
    );
    await inspector.getByLabel('Palette mode', { exact: true }).selectOption('night');
    await expect(desktop.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(221, 238, 255)');
});

test('launches Preview with the selected view’s colors and keeps its session independent of later view edits', async ({
    page
}) => {
    const { inspector, desktop } = await openModes(page);
    await selectView(page, 'desktop');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const runtime = page.frameLocator('iframe[title="Application preview"]');
    await expect(runtime.locator('rect[fill="#ddeeff"]')).toHaveCount(2);
    await inspector.getByLabel('Palette mode', { exact: true }).selectOption('day');
    await expect(desktop.locator('[data-cy="Body"]')).toHaveCSS('fill', 'rgb(17, 34, 51)');
    await expect(runtime.locator('rect[fill="#ddeeff"]')).toHaveCount(2);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(runtime.locator('rect[fill="#112233"]')).toHaveCount(2);
});

test('uses each view’s inherited colors in document thumbnails', async ({ page }) => {
    await openModes(page);
    await page.getByRole('link', { name: 'Documents', exact: true }).click();
    const thumbnail = page.getByRole('img', { name: 'Preview of Mode screens', exact: true });
    await expect(thumbnail.locator('rect[fill="#ddeeff"]')).toHaveCount(2);
    await expect(thumbnail.locator('rect[fill="#112233"]')).toHaveCount(2);
});
