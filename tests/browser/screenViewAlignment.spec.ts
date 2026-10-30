import { expect, test, type Page } from '@playwright/test';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { expectPlacedCoordinate, openEditor, pointer } from './support/editor';

async function openViews(page: Page, { stack = false, component = false } = {}) {
    const shapes = [
        [120, 110, 20, 20],
        [200, 170, 60, 40],
        [420, 310, 40, 60]
    ].map(([x, y, width, height], index) =>
        createShape({
            type: 'rectangle',
            name: `Part ${index + 1}`,
            order: `a${index}`,
            position: { x, y },
            size: { width, height },
            parentFrameId: 'home',
            fill: '#888888',
            selected: false
        })
    );
    const document = createDocument({
        id: 'screen-view-alignment',
        shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
        components: component
            ? {
                  card: createComponent({
                      id: 'card',
                      name: 'Card',
                      shapesIds: shapes.slice(0, 2).map((shape) => shape.id)
                  })
              }
            : {},
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                definitionOnly: true,
                name: 'Home',
                position: { x: 100, y: 80 },
                size: { width: 400, height: 350 },
                visible: true,
                locked: false,
                ...(stack
                    ? {
                          stack: {
                              direction: 'column' as const,
                              gap: 20,
                              padding: 20,
                              align: 'end' as const
                          }
                      }
                    : {})
            },
            mobile: {
                id: 'mobile',
                kind: 'view',
                name: 'Mobile',
                screenId: 'home',
                position: { x: 100, y: 80 },
                size: { width: 400, height: 350 },
                visible: true,
                locked: false
            },
            desktop: {
                id: 'desktop',
                kind: 'view',
                name: 'Desktop',
                screenId: 'home',
                position: { x: 520, y: 300 },
                size: { width: 500, height: 300 },
                visible: true,
                locked: false
            }
        }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector']);
    await page.getByRole('button', { name: 'More panels' }).click();

    return {
        desktop: page.locator('#screen-views > [data-screen-view="desktop"]'),
        mobile: page.locator('#screen-views > [data-screen-view="mobile"]')
    };
}

async function selectView(page: Page, viewId = 'desktop') {
    const desktop = viewId === 'desktop';
    const from = desktop ? { x: 530, y: 320 } : { x: 110, y: 100 };
    const to = desktop ? { x: 990, y: 595 } : { x: 480, y: 400 };
    await pointer(page, 'pointerdown', {
        ...from,
        target: `#screen-views > [data-screen-view="${viewId}"]`
    });
    await pointer(page, 'pointermove', to);
    await pointer(page, 'pointerup', to);
}

test('aligns shared artwork from the Inspector and keyboard in the active Screen view', async ({
    page
}) => {
    const { desktop, mobile } = await openViews(page);
    await selectView(page);
    const align = page.getByRole('toolbar', { name: 'Align menu' });
    await expect(align.getByRole('button', { name: 'Align left', exact: true })).toBeEnabled();
    await page.keyboard.press('Shift+A');
    for (const name of ['Part 1', 'Part 2', 'Part 3']) {
        await expectPlacedCoordinate(desktop.locator(`[data-cy="${name}"]`), 'x', '540');
        await expectPlacedCoordinate(mobile.locator(`[data-cy="${name}"]`), 'x', '120');
    }
    await align.getByRole('button', { name: 'Align bottom', exact: true }).click();
    await expectPlacedCoordinate(desktop.locator('[data-cy="Part 1"]'), 'y', '570');
    await expectPlacedCoordinate(mobile.locator('[data-cy="Part 1"]'), 'y', '350');
    await page.screenshot({ path: 'test-results/screen-view-alignment.png' });
});

for (const [name, axis, coordinate] of [
    ['Space between horizontally', 'x', '670'],
    ['Space equally horizontally', 'x', '675'],
    ['Space between vertically', 'y', '420'],
    ['Space equally vertically', 'y', '430']
] as const) {
    test(`${name} uses placed bounds and keeps its spacing meaning`, async ({ page }) => {
        const { desktop } = await openViews(page);
        await selectView(page);
        await page
            .getByRole('toolbar', { name: 'Space menu' })
            .getByRole('button', { name, exact: true })
            .click();
        await expectPlacedCoordinate(desktop.locator('[data-cy="Part 2"]'), axis, coordinate);
        await expectPlacedCoordinate(desktop.locator('[data-cy="Part 1"]'), 'x', '540');
        await expectPlacedCoordinate(desktop.locator('[data-cy="Part 3"]'), 'x', '840');
    });
}

test('the context menu counts a local component as one item and aligns it as a whole', async ({
    page
}) => {
    const { desktop } = await openViews(page, { component: true });
    await selectView(page);
    await expect(
        page
            .getByRole('toolbar', { name: 'Space menu' })
            .getByRole('button', { name: 'Space between horizontally', exact: true })
    ).toBeDisabled();
    await page.getByRole('button', { name: 'More panels' }).click();
    await page.getByRole('checkbox', { name: 'Inspector', exact: true }).uncheck();
    await page.getByRole('button', { name: 'More panels' }).click();
    await desktop.locator('[data-cy="Part 3"]').click({ button: 'right' });
    const menu = page.locator('[data-cy="context-menu"]');
    await menu.getByRole('menuitem', { name: 'Align', exact: true }).click();
    await menu.getByRole('menuitem', { name: /^Align bottom/ }).click();
    await expectPlacedCoordinate(desktop.locator('[data-cy="Part 1"]'), 'y', '490');
    await expectPlacedCoordinate(desktop.locator('[data-cy="Part 2"]'), 'y', '550');
    await expectPlacedCoordinate(desktop.locator('[data-cy="Part 3"]'), 'y', '530');
});

test('keeps stack-controlled artwork selectable while alignment stays unavailable', async ({
    page
}) => {
    const { desktop } = await openViews(page, { stack: true });
    await selectView(page);
    await expect(desktop.locator('rect[stroke="var(--selection-color)"]')).toHaveCount(3);
    await expect(page.getByRole('toolbar', { name: 'Align menu' })).toHaveCount(0);
    const before = await desktop
        .locator('[data-cy]')
        .evaluateAll((items) =>
            items.map((item) => [item.getAttribute('x'), item.getAttribute('y')])
        );
    await page.keyboard.press('Shift+A');
    expect(
        await desktop
            .locator('[data-cy]')
            .evaluateAll((items) =>
                items.map((item) => [item.getAttribute('x'), item.getAttribute('y')])
            )
    ).toEqual(before);
});

test('aligns through the Mobile view at narrow widths', async ({ page }) => {
    const { mobile } = await openViews(page);
    await page.getByRole('button', { name: 'More panels' }).click();
    await page.getByRole('checkbox', { name: 'Inspector', exact: true }).uncheck();
    await page.getByRole('button', { name: 'More panels' }).click();
    await page.setViewportSize({ width: 600, height: 850 });
    await selectView(page, 'mobile');
    await page.keyboard.press('Shift+A');
    for (const name of ['Part 1', 'Part 2', 'Part 3']) {
        await expectPlacedCoordinate(mobile.locator(`[data-cy="${name}"]`), 'x', '120');
    }
    await page.screenshot({ path: 'test-results/screen-view-alignment-narrow.png' });
});
