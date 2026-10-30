import { selectVariable } from './support/variables';
import { expect, test, type Page } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { expectPlacedCoordinate, openEditor, pointer } from './support/editor';
import type { Frame } from 'src/app/types';

async function openLayout(page: Page, extraFrames: Record<string, Frame> = {}) {
    const frame = (id: string, name: string, x: number, y: number): Frame => ({
        id,
        name,
        kind: 'frame',
        position: { x, y },
        size: { width: 400, height: 200 },
        visible: true,
        locked: false
    });
    const first = createShape({
        type: 'rectangle',
        name: 'First',
        order: 'a0',
        position: { x: 120, y: 120 },
        size: { width: 40, height: 30 },
        fill: '#336699',
        parentFrameId: 'content',
        bindings: { width: 'width' }
    });
    const second = createShape({
        type: 'rectangle',
        name: 'Second',
        order: 'a1',
        position: { x: 180, y: 120 },
        size: { width: 40, height: 30 },
        fill: '#669933',
        parentFrameId: 'content'
    });
    first.id = 'first';
    second.id = 'second';
    const document = createDocument({
        id: 'layout',
        name: 'Density layouts',
        dimensions: {
            density: {
                id: 'density',
                name: 'Density',
                order: 0,
                defaultModeId: 'compact',
                modes: {
                    compact: { id: 'compact', name: 'Compact', order: 0 },
                    comfortable: { id: 'comfortable', name: 'Comfortable', order: 1 }
                }
            }
        },
        variables: {
            space: {
                id: 'space',
                name: 'Space',
                type: 'number',
                dimensionId: 'density',
                values: { default: 10, comfortable: 20 }
            },
            width: {
                id: 'width',
                name: 'Control width',
                type: 'number',
                dimensionId: 'density',
                values: { default: 40, comfortable: 80 }
            }
        },
        frames: {
            screen: { ...frame('screen', 'Home', 100, 100), kind: 'screen', definitionOnly: true },
            compact: { ...frame('compact', 'Compact', 100, 100), kind: 'view', screenId: 'screen' },
            comfortable: {
                ...frame('comfortable', 'Comfortable', 600, 350),
                kind: 'view',
                screenId: 'screen',
                modeOverrides: { density: 'comfortable' }
            },
            content: {
                ...frame('content', 'Content', 110, 110),
                size: { width: 250, height: 100 },
                parentFrameId: 'screen',
                stack: { direction: 'row', gap: 10, padding: 10, align: 'start' },
                bindings: { gap: 'space', padding: 'space' }
            },
            ...extraFrames
        },
        shapes: { first, second },
        shapesIds: ['first', 'second']
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await openEditor(page, ['Inspector', 'Explorer']);
    await page.getByRole('button', { name: 'More panels' }).click();

    return {
        compact: page.locator('#screen-views > [data-screen-view="compact"]'),
        comfortable: page.locator('#screen-views > [data-screen-view="comfortable"]'),
        inspector: page.locator('[data-panel="inspector"]'),
        explorer: page.getByRole('region', { name: 'Explorer' })
    };
}

test('draws and hit-tests the per-view sizes and preserves stack gesture restrictions', async ({
    page
}) => {
    const { compact, comfortable, inspector } = await openLayout(page);
    await expect(compact.locator('[data-cy="First"]')).toHaveAttribute('width', '40');
    await expect(comfortable.locator('[data-cy="First"]')).toHaveAttribute('width', '80');
    await expectPlacedCoordinate(comfortable.locator('[data-cy="Second"]'), 'x', '730');
    // This point is inside only the contextual 80px rectangle, beyond its base width.
    await pointer(page, 'pointerdown', {
        x: 700,
        y: 390,
        target: '#screen-views > [data-screen-view="comfortable"]'
    });
    await pointer(page, 'pointerup', { x: 700, y: 390 });
    await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('First');
    await expect(
        comfortable.locator('[data-shape-id="first"] [data-type="bottomRight"]')
    ).toHaveCount(0);
    await pointer(page, 'pointerdown', {
        x: 700,
        y: 390,
        target: '#screen-views > [data-screen-view="comfortable"]'
    });
    await pointer(page, 'pointermove', { x: 740, y: 420 });
    await pointer(page, 'pointerup', { x: 740, y: 420 });
    await expectPlacedCoordinate(comfortable.locator('[data-cy="First"]'), 'x', '630');
    await expect(comfortable.locator('[data-cy="First"]')).toHaveAttribute('width', '80');
});

test('authors number overrides and frame bindings, with inheritance, reload and undo', async ({
    page
}) => {
    const { compact, comfortable, inspector, explorer } = await openLayout(page);
    const branch = explorer
        .getByRole('button', { name: 'Home · Comfortable', exact: true })
        .locator('xpath=ancestor::li[1]');
    await branch.getByRole('button', { name: 'Content', exact: true }).click();
    await expect(inspector.getByLabel('Variable for frame gap', { exact: true })).toHaveValue(
        'space'
    );
    await inspector.getByLabel('Variable for frame gap', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/reactor-contextual-layout-bindings.png' });
    await inspector.getByLabel('Variable for frame gap', { exact: true }).selectOption('');
    await expectPlacedCoordinate(comfortable.locator('[data-cy="Second"]'), 'x', '720');
    await page.getByRole('button', { name: /Undo/ }).first().click();
    await expectPlacedCoordinate(comfortable.locator('[data-cy="Second"]'), 'x', '730');
    await page.locator('#frames > [data-frame="comfortable"]').press('Enter');
    await inspector.getByLabel('Density mode', { exact: true }).selectOption('compact');
    await expect(comfortable.locator('[data-cy="First"]')).toHaveAttribute('width', '40');
    await page.reload();
    await expect(comfortable.locator('[data-cy="First"]')).toHaveAttribute('width', '40');
    await expect(compact.locator('[data-cy="First"]')).toHaveAttribute('width', '40');
});

test('edits numeric mode values in Variables and keeps Preview geometry equal to its launch view', async ({
    page
}) => {
    const { compact, comfortable } = await openLayout(page);
    await page.getByRole('button', { name: 'More panels' }).click();
    await page.getByRole('checkbox', { name: 'Variables', exact: true }).check();
    await page.getByRole('button', { name: 'More panels' }).click();
    const variables = page.getByRole('region', { name: 'Variables', exact: true });
    await selectVariable(page, 'Control width');
    const field = variables.getByLabel('Comfortable value of Control width', { exact: true });
    await field.fill('90');
    await field.press('Enter');
    await expect(comfortable.locator('[data-cy="First"]')).toHaveAttribute('width', '90');
    await expect(compact.locator('[data-cy="First"]')).toHaveAttribute('width', '40');
    await page.locator('#frames > [data-frame="comfortable"]').press('Enter');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const runtime = page.frameLocator('iframe[title="Application preview"]');
    await expect(runtime.locator('rect[width="90"]')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/reactor-contextual-layout.png' });
});

test('keeps mode and binding controls usable at narrow widths', async ({ page }) => {
    const { inspector, comfortable, explorer } = await openLayout(page);
    await page.setViewportSize({ width: 600, height: 900 });
    await page.locator('#frames > [data-frame="comfortable"]').press('Enter');
    await inspector.getByLabel('Density mode', { exact: true }).selectOption('compact');
    await expect(comfortable.locator('[data-cy="First"]')).toHaveAttribute('width', '40');
    await page.screenshot({ path: 'test-results/reactor-contextual-layout-narrow.png' });
    const branch = explorer
        .getByRole('button', { name: 'Home · Comfortable', exact: true })
        .locator('xpath=ancestor::li[1]');
    await branch.getByRole('button', { name: 'Content', exact: true }).click();
    await inspector.getByLabel('Variable for frame gap', { exact: true }).scrollIntoViewIfNeeded();
    await inspector.getByLabel('Variable for frame padding', { exact: true }).selectOption('space');
    await expect(inspector.getByLabel('Variable for frame padding', { exact: true })).toHaveValue(
        'space'
    );
    await page.screenshot({ path: 'test-results/reactor-contextual-layout-bindings-narrow.png' });
});

test('offers no size variables for a Screen and resizes only the unbound axis of a frame', async ({
    page
}) => {
    const { inspector, explorer } = await openLayout(page, {
        panel: {
            id: 'panel',
            name: 'Panel',
            kind: 'frame',
            position: { x: 1100, y: 100 },
            size: { width: 40, height: 200 },
            bindings: { width: 'width' },
            visible: true,
            locked: false
        }
    });
    await explorer.getByRole('button', { name: 'Home', exact: true }).first().click();
    await expect(inspector.getByLabel('Variable for frame width', { exact: true })).toHaveCount(0);
    await expect(inspector.getByLabel('Variable for frame height', { exact: true })).toHaveCount(0);
    await page.locator('#frames > [data-frame="panel"]').press('Enter');
    const handles = page.locator('#frames > [data-frame="panel"] circle[data-type]');
    await expect(handles).toHaveCount(4);
    await expect(inspector.getByLabel('Variable for frame width', { exact: true })).toHaveValue(
        'width'
    );
    const corner = '#frames > [data-frame="panel"] [data-type="bottomRight"]';
    await pointer(page, 'pointerdown', { x: 1140, y: 300, target: corner });
    await pointer(page, 'pointermove', { x: 1200, y: 350 });
    await pointer(page, 'pointerup', { x: 1200, y: 350 });
    const edge = page.locator('#frames > [data-frame="panel"] rect').first();
    await expect(edge).toHaveAttribute('height', '250');
    await expect(edge).toHaveAttribute('width', '40');
    await expect(inspector.getByLabel('Variable for frame width', { exact: true })).toHaveValue(
        'width'
    );
});
