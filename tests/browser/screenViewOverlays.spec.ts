import { expect, test, type Page } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor, pointer } from './support/editor';

async function openViews(
    page: Page,
    { explorer = false, stack = false }: { explorer?: boolean; stack?: boolean } = {}
) {
    const body = createShape({
        type: 'rectangle',
        name: 'Body',
        order: 'a0',
        position: { x: 120, y: 110 },
        size: { width: 80, height: 60 },
        fill: '#888888',
        ...(stack ? { sizing: { width: { mode: 'fill' as const } } } : {}),
        parentFrameId: 'home',
        selected: false
    });
    const target = createShape({
        type: 'rectangle',
        name: 'Target',
        order: 'a1',
        position: { x: 260, y: 110 },
        size: { width: 40, height: 60 },
        fill: '#888888',
        parentFrameId: 'home',
        selected: false
    });
    const document = createDocument({
        id: 'screen-view-overlays',
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                name: 'Home',
                position: { x: 100, y: 80 },
                size: { width: 360, height: 260 },
                visible: true,
                locked: false,
                ...(stack
                    ? {
                          stack: {
                              direction: 'column' as const,
                              gap: 20,
                              padding: 10,
                              align: 'start' as const
                          }
                      }
                    : {})
            },
            desktop: {
                id: 'desktop',
                kind: 'view',
                name: 'Desktop',
                screenId: 'home',
                position: { x: 520, y: 300 },
                size: { width: 500, height: 280 },
                visible: true,
                locked: false
            }
        },
        shapes: { [body.id]: body, [target.id]: target }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, explorer ? ['Explorer'] : []);
    await page.getByRole('button', { name: 'More panels' }).click();

    return {
        desktop: page.locator('svg#surface #screen-views > [data-screen-view="desktop"]'),
        mobile: page.locator('svg#surface #screen-views > [data-screen-view="home:view"]')
    };
}

test('anchors the menu to the selected view and runs shared lock, clone and delete commands', async ({
    page
}) => {
    const { desktop, mobile } = await openViews(page);
    await desktop.locator('[data-cy="Body"]').click();
    const toolbar = page.getByRole('toolbar', { name: 'Selection menu' });
    const host = toolbar.locator('..');
    await expect(host).toHaveCSS('opacity', '1');
    await expect(host).toHaveCSS('left', '540px');
    await expect(host).toHaveCSS('top', '292px');
    await toolbar.getByRole('button', { name: 'Lock', exact: true }).click();
    await expect(toolbar.getByRole('button', { name: 'Unlock', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await expect(desktop.locator('[data-handle]')).toHaveCount(0);
    await toolbar.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(desktop.locator('[data-type="bottomRight"]')).toBeVisible();
    await toolbar.getByRole('button', { name: 'Clone', exact: true }).click();
    await expect(desktop.locator('[data-cy]')).toHaveCount(3);
    await expect(mobile.locator('[data-cy]')).toHaveCount(3);
    await toolbar.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(desktop.locator('[data-cy]')).toHaveCount(2);
    await expect(mobile.locator('[data-cy]')).toHaveCount(2);
    await expect(toolbar).toHaveCount(0);

    await mobile.locator('[data-cy="Body"]').click();
    await expect(host).toHaveCSS('left', '120px');
    await expect(host).toHaveCSS('top', '72px');
    await page.setViewportSize({ width: 600, height: 850 });
    const menuBox = (await toolbar.boundingBox())!;
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(600);
    await page.screenshot({ path: '/private/tmp/reactor-screen-view-menu-narrow.png' });
});

test('shows Alt distances only within the active view and keeps resize snap paths in view coordinates', async ({
    page
}) => {
    const { desktop, mobile } = await openViews(page);
    await desktop.locator('[data-cy="Body"]').click();
    const labels = page.locator('svg#surface [data-measures] text');
    await page.keyboard.down('Alt');
    await desktop.locator('[data-cy="Target"]').hover();
    await expect(labels).toHaveText(['60']);
    await expect(desktop.locator('text')).toHaveText('80 x 60');
    await mobile.locator('[data-cy="Target"]').hover();
    await expect(labels).toHaveCount(0);
    await page.keyboard.up('Alt');

    const resize = '#screen-views > [data-screen-view="desktop"] [data-type="bottomRight"]';
    await pointer(page, 'pointerdown', { x: 620, y: 390, target: resize });
    await pointer(page, 'pointermove', { x: 676, y: 390 });
    await expect(page.getByRole('toolbar', { name: 'Selection menu' })).toHaveCount(0);
    await expect(desktop.locator('[data-cy="Body"]')).toHaveAttribute('width', '140');
    await expect(desktop.locator('text')).toHaveText('140 x 60');
    await expect(page.locator('svg#surface path[d^="M680 324L680 396"]')).toHaveCount(2);
    await pointer(page, 'pointercancel', { x: 676, y: 390 });
    await expect(desktop.locator('[data-cy="Body"]')).toHaveAttribute('width', '80');
    await expect(page.locator('svg#surface [data-measures]')).toHaveCount(0);
});

test('keeps instance badges and Explorer selections in the chosen view and removes stale overlays', async ({
    page
}) => {
    const { desktop } = await openViews(page, { explorer: true });
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const row = explorer
        .getByRole('button', { name: 'Home · Desktop', exact: true })
        .locator('xpath=ancestor::li[1]');
    await row.getByRole('button', { name: 'Body', exact: true }).click();
    const menu = page.getByRole('toolbar', { name: 'Selection menu' });
    await desktop.locator('[data-cy="Body"]').hover();
    await expect(menu.locator('..')).toHaveCSS('left', '540px');
    await menu.getByRole('button', { name: 'Create component', exact: true }).click();
    const badge = page.locator('[data-selection-badge]');
    await expect(badge).toHaveAttribute('data-object-type', 'instance');
    await expect(badge).toHaveCSS('left', '540px');
    await page.screenshot({ path: '/private/tmp/reactor-screen-view-menu.png' });
    await row.getByRole('button', { name: 'Home · Desktop', exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(badge).toHaveCount(0);
});

test('right-click actions keep the selected view address and update shared artwork', async ({
    page
}) => {
    const { desktop, mobile } = await openViews(page);
    await desktop.locator('[data-cy="Body"]').click({ button: 'right' });
    const context = page.locator('[data-cy="context-menu"]');
    await expect(context).toHaveAttribute('aria-label', 'Body actions');
    await expect(page.getByRole('toolbar', { name: 'Selection menu' })).toHaveCount(0);
    await context.getByRole('menuitem', { name: 'Clone' }).click();
    await expect(desktop.locator('[data-cy]')).toHaveCount(3);
    await expect(mobile.locator('[data-cy]')).toHaveCount(3);
    const menu = page.getByRole('toolbar', { name: 'Selection menu' });
    await expect(menu.locator('..')).toHaveCSS('left', '550px');
});

test('displays dimensions resolved at each responsive Screen view size', async ({ page }) => {
    const { desktop, mobile } = await openViews(page, { stack: true });
    await desktop.locator('[data-cy="Body"]').click();
    await expect(desktop.locator('text')).toHaveText('480 x 60');
    await expect(mobile.locator('text')).toHaveText('340 x 60');
    await expect(desktop.locator('[data-handle]')).toHaveCount(0);
});
