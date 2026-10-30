import { expect, test } from '@playwright/test';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { expectPlacedCoordinate, openEditor, pointer, selectTool } from './support/editor';

test('places a second view, resolves its width, edits shared content and deletes only the view', async ({
    page
}) => {
    const body = createShape({
        type: 'rectangle',
        name: 'Body',
        order: 'a0',
        position: { x: 120, y: 100 },
        size: { width: 40, height: 30 },
        parentFrameId: 'home',
        sizing: { width: { mode: 'fill' } }
    });
    const document = createDocument({
        id: 'screen-views-browser',
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                name: 'Home',
                position: { x: 100, y: 80 },
                size: { width: 300, height: 200 },
                stack: { direction: 'column', gap: 0, padding: 10, align: 'start' },
                visible: true,
                locked: false
            }
        },
        shapes: { [body.id]: body }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });

    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector', 'Explorer']);
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Create Screen view' }).click();
    await expect(page.getByLabel('Screen view properties')).toBeVisible();
    await page.getByLabel('View name').fill('Desktop');
    await page.getByLabel('View name').press('Enter');
    await expect(
        explorer.getByRole('button', { name: 'Home · Desktop', exact: true })
    ).toHaveAccessibleDescription('Home · 300 × 200 Screen view');

    const original = page.locator(
        'svg#surface #screen-views > [data-screen-view="home:view"] rect[data-cy="Body"]'
    );
    const projected = page.locator(
        'svg#surface #screen-views > g:not([data-screen-view="home:view"]) rect[data-cy="Body"]'
    );
    await expect(original).toHaveAttribute('width', '280');
    await expectPlacedCoordinate(projected, 'x', '450');
    const viewId = await page
        .locator('svg#surface #frames > [data-frame]')
        .filter({ hasText: 'Home · Desktop' })
        .getAttribute('data-frame');
    await pointer(page, 'pointerdown', {
        x: 440,
        y: 140,
        target: `#frame-grips [data-frame-id="${viewId}"]`
    });
    await pointer(page, 'pointermove', { x: 470, y: 140 });
    await pointer(page, 'pointercancel', { x: 470, y: 140 });
    await expect(page.getByLabel('View x')).toHaveValue('440');
    await expectPlacedCoordinate(projected, 'x', '450');
    await page.getByLabel('View width').fill('500');
    await page.getByLabel('View width').press('Enter');
    await expect(projected).toHaveAttribute('width', '480');
    await expect(original).toHaveAttribute('width', '280');

    await pointer(page, 'pointerdown', {
        x: 460,
        y: 100,
        target: '#screen-views > g:not([data-screen-view="home:view"]) rect[data-cy="Body"]'
    });
    await pointer(page, 'pointerup', {
        x: 460,
        y: 100,
        target: '#screen-views > g:not([data-screen-view="home:view"]) rect[data-cy="Body"]'
    });
    await page.getByLabel('Name', { exact: true }).fill('Heading');
    await page.getByLabel('Name', { exact: true }).press('Enter');
    await expect(page.locator('svg#surface #shapes rect[data-cy="Heading"]')).toHaveCount(1);
    await expect(
        page.locator(
            'svg#surface #screen-views > g:not([data-screen-view="home:view"]) rect[data-cy="Heading"]'
        )
    ).toHaveCount(1);

    await explorer.getByRole('button', { name: 'Home · Desktop', exact: true }).click();
    await page.screenshot({ path: '/tmp/reactor-screen-views.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(page.getByLabel('View width')).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-screen-views-narrow.png' });
    await page.getByRole('button', { name: 'Delete Screen view' }).click();
    await expect(projected).toHaveCount(0);
    await expect(page.locator('svg#surface #screen-views [data-shape-id]')).toHaveCount(1);
    await expect(explorer.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
    await page.reload();
    await expect(explorer.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
});

test('selects projected instances and ignores secondary presses during a gesture', async ({
    page
}) => {
    const source = createShape({
        type: 'rectangle',
        name: 'Source',
        order: 'a0',
        position: { x: 0, y: 0 },
        size: { width: 60, height: 40 }
    });
    const component = createComponent({ shapesIds: [source.id] });
    const instance = createShape({
        type: 'instance',
        name: 'Card',
        order: 'a1',
        componentId: component.id,
        overrides: {},
        position: { x: 120, y: 100 },
        parentFrameId: 'home'
    });
    const document = createDocument({
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                name: 'Home',
                position: { x: 100, y: 80 },
                size: { width: 200, height: 200 },
                visible: true,
                locked: false
            },
            view: {
                id: 'view',
                kind: 'view',
                screenId: 'home',
                name: 'Second',
                position: { x: 400, y: 80 },
                size: { width: 200, height: 200 },
                visible: true,
                locked: false
            }
        },
        shapes: { [source.id]: source, [instance.id]: instance },
        components: { [component.id]: component }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector', 'Explorer']);
    await page.getByRole('button', { name: 'More panels' }).click();
    const hit = page.locator(
        'svg#surface #screen-views > [data-screen-view="view"] [data-view-instance-hit]'
    );
    await expect(hit).toHaveAttribute('width', '60');
    await hit.click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Card');

    const hitBox = (await hit.boundingBox())!;
    await page.mouse.move(hitBox.x + 1, hitBox.y + 1);
    await page.mouse.down();
    await page.mouse.move(hitBox.x + 34, hitBox.y + 22);
    await page.mouse.up();
    await expectPlacedCoordinate(hit, 'x', '453');
    await expectPlacedCoordinate(hit, 'y', '121');

    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Home · Second', exact: true }).click();
    await pointer(page, 'pointerdown', {
        x: 400,
        y: 150,
        target: '#frame-grips [data-frame-id="view"]'
    });
    await pointer(page, 'pointerdown', {
        pointerId: 2,
        x: 430,
        y: 110,
        target: '#screen-views > [data-screen-view="view"] [data-view-instance-hit]'
    });
    await expect(page.getByLabel('Screen view properties')).toBeVisible();
    await pointer(page, 'pointercancel', { x: 400, y: 150 });
    await hit.dispatchEvent('pointerdown', { button: 2, bubbles: true });
    await expect(page.getByLabel('Screen view properties')).toBeVisible();
});

test('draws and drags source artwork through a Screen view, cancels a drag and retains it after reload', async ({
    page
}) => {
    const body = createShape({
        type: 'rectangle',
        name: 'Body',
        order: 'a0',
        position: { x: 120, y: 120 },
        size: { width: 50, height: 40 },
        parentFrameId: 'home'
    });
    const document = createDocument({
        id: 'view-gestures-browser',
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                name: 'Home',
                position: { x: 100, y: 80 },
                size: { width: 240, height: 200 },
                visible: true,
                locked: false
            },
            view: {
                id: 'view',
                kind: 'view',
                screenId: 'home',
                name: 'Wide',
                position: { x: 450, y: 80 },
                size: { width: 400, height: 240 },
                visible: true,
                locked: false
            }
        },
        shapes: { [body.id]: body }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector']);
    await page.getByRole('button', { name: 'More panels' }).click();
    await selectTool(page, 'Draws a rectangle or square');
    const surface = page.locator('svg#surface');
    const box = (await surface.boundingBox())!;
    await page.mouse.move(box.x + 550, box.y + 170);
    await page.mouse.down();
    await page.mouse.move(box.x + 610, box.y + 210, { steps: 3 });
    await expectPlacedCoordinate(page.locator('#tools rect'), 'x', '550');
    await page.mouse.up();
    const original = page.locator(
        'svg#surface #screen-views > [data-screen-view="home:view"] rect[data-cy="rectangle-1"]'
    );
    const projected = page.locator(
        'svg#surface #screen-views > [data-screen-view="view"] rect[data-cy="rectangle-1"]'
    );
    await expectPlacedCoordinate(original, 'x', '200');
    await expectPlacedCoordinate(projected, 'x', '550');
    await expect(page.getByLabel('Selection parent')).toContainText('Home');
    await page.mouse.move(box.x + 550, box.y + 170);
    await page.mouse.down();
    await page.mouse.move(box.x + 587, box.y + 197, { steps: 3 });
    await page.mouse.up();
    await expectPlacedCoordinate(projected, 'x', '587');
    await expectPlacedCoordinate(original, 'x', '237');
    await page.mouse.down();
    await page.mouse.move(box.x + 617, box.y + 227);
    await surface.dispatchEvent('pointercancel', { pointerId: 1 });
    await page.mouse.up();
    await expectPlacedCoordinate(projected, 'x', '587');
    await expectPlacedCoordinate(original, 'x', '237');
    await page.reload();
    await expectPlacedCoordinate(projected, 'x', '587');
    await expectPlacedCoordinate(original, 'x', '237');
    await selectTool(page, 'Type a text');
    await pointer(page, 'pointerdown', {
        x: 520,
        y: 250,
        target: '#screen-views > g[data-screen-view="view"] > rect'
    });
    await pointer(page, 'pointerup', { x: 520, y: 250 });
    const text = page.getByPlaceholder('Type something...');
    await text.fill('Anchored');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Home · Wide', exact: true })
        .click();
    await page.getByLabel('View x').fill('650');
    await page.getByLabel('View x').press('Enter');
    await expectPlacedCoordinate(page.locator('#tools foreignObject'), 'x', '720');
    await text.press('Enter');
    await expectPlacedCoordinate(
        page.locator('svg#surface #shapes text[data-cy="text-1"]'),
        'x',
        '170'
    );
    await expectPlacedCoordinate(
        page.locator(
            'svg#surface #screen-views > [data-screen-view="view"] text[data-cy="text-1"]'
        ),
        'x',
        '720'
    );
    await page.screenshot({ path: '/tmp/reactor-screen-view-gestures.png' });
});

test('moves a view from just inside its edge, and lets presses through a locked view', async ({
    page
}) => {
    const document = createDocument({
        id: 'screen-view-edges',
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                name: 'Home',
                position: { x: 100, y: 80 },
                size: { width: 300, height: 200 },
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
    await openEditor(page, ['Inspector', 'Explorer']);
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Home', exact: true }).click();
    // Placed beside the first view, clear of the panels.
    await page.getByRole('button', { name: 'Create Screen view', exact: true }).click();
    await expect(page.getByLabel('Screen view properties')).toBeVisible();
    const viewId = await page
        .locator('svg#surface #frames > [data-frame]')
        .filter({ hasText: 'Home · 300 px 2' })
        .getAttribute('data-frame');
    const x = Number(await page.getByLabel('View x').inputValue());
    const grip = page.locator(`#frame-grips [data-frame-id="${viewId}"]`);
    // The grip's box includes its 12px stroke: 6px outside the edge, 6px inside.
    const box = (await grip.boundingBox())!;
    const inside = { x: box.x + 9, y: box.y + box.height / 2 };
    const pressed = (point: { x: number; y: number }) =>
        page.evaluate(({ x, y }) => {
            const element = window.document.elementFromPoint(x, y);

            return {
                grip: element?.getAttribute('data-frame-id') ?? null,
                view: Boolean(element?.closest('[data-screen-view]'))
            };
        }, point);

    expect(await pressed(inside)).toEqual({ grip: viewId, view: false });
    await page.mouse.move(inside.x, inside.y);
    await page.mouse.down();
    await page.mouse.move(inside.x + 40, inside.y, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByLabel('View x')).toHaveValue(String(x + 40));

    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    expect((await pressed(center)).view).toBe(true);
    const viewRow = explorer
        .getByRole('button', { name: 'Home · 300 px 2', exact: true })
        .locator('..');
    await viewRow.hover();
    await viewRow.getByRole('button', { name: 'Lock', exact: true }).click();
    await expect.poll(async () => (await pressed(center)).view).toBe(false);
});
