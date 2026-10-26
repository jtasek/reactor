import { expect, test, type Page } from '@playwright/test';
import { createDocument, createShape, createComponent } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor, pointer, selectTool } from './support/editor';

async function openComponent(page: Page, explorer = false, sourceOnly = false, rotation = 0) {
    const shapes = [120, 180, 260].map((x, i) =>
        createShape({
            type: 'rectangle',
            name: `Part ${i + 1}`,
            order: `a${i}`,
            position: { x, y: 110 },
            size: { width: 40, height: 40 },
            fill: '#888888',
            parentFrameId: 'home',
            selected: false
        })
    );
    if (sourceOnly) {
        shapes.slice(0, 2).forEach((shape) => {
            delete shape.parentFrameId;
        });
    }
    const instance = createShape({
        type: 'instance',
        name: 'Card instance',
        order: 'a3',
        componentId: 'card',
        position: { x: 140, y: 160 },
        rotation,
        parentFrameId: 'home',
        overrides: {},
        selected: false
    });
    const document = createDocument({
        id: 'focused-view-component',
        shapes: Object.fromEntries(
            [...shapes, ...(sourceOnly ? [instance] : [])].map((shape) => [shape.id, shape])
        ),
        components: {
            card: createComponent({
                id: 'card',
                name: 'Card',
                sourceOnly,
                shapesIds: shapes.slice(0, 2).map((shape) => shape.id)
            })
        },
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                name: 'Home',
                position: { x: 100, y: 80 },
                size: { width: 300, height: 200 },
                visible: true,
                locked: false
            },
            desktop: {
                id: 'desktop',
                kind: 'view',
                name: 'Desktop',
                screenId: 'home',
                position: { x: 500, y: 300 },
                size: { width: 500, height: 250 },
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
    await openEditor(page, explorer ? ['Explorer'] : []);
    await page.getByRole('button', { name: 'More panels' }).click();

    return {
        desktop: page.locator('#screen-views > [data-screen-view="desktop"]'),
        mobile: page.locator('#screen-views > [data-screen-view="home:view"]')
    };
}

async function focusDesktop(page: Page) {
    const surface = (await page.locator('svg#surface').boundingBox())!;
    // The first press selects the container; the next enters its source child.
    await page.mouse.click(surface.x + 540, surface.y + 350);
    await page.mouse.click(surface.x + 540, surface.y + 350);
    const navigation = page.getByRole('navigation', { name: 'Component editing' });
    await expect(navigation).toContainText('Card');
    await expect(navigation).toContainText('Home · Desktop');
    await page.getByRole('button', { name: 'More panels' }).click();
    await page.getByRole('checkbox', { name: 'Inspector', exact: true }).uncheck();
    await page.getByRole('button', { name: 'More panels' }).click();

    return navigation;
}

test('edits and draws focused children in their Screen view, then returns to the container', async ({
    page
}) => {
    const { desktop, mobile } = await openComponent(page);
    const navigation = await focusDesktop(page);
    await expect(page.locator('#screen-views > g')).toHaveCount(2);
    await expect(desktop.locator('[data-cy="Part 3"]')).toBeVisible();
    await expect(desktop.locator('[data-component-selection]')).toHaveCount(0);
    await expect(desktop.locator('[data-shape-id] [data-type="bottomRight"]')).toHaveCount(1);
    await expect(page.locator('svg#surface #shapes > g:visible [data-cy="Part 1"]')).toHaveCount(0);

    const target = '#screen-views > [data-screen-view="desktop"] [data-type="bottomRight"]';
    await pointer(page, 'pointerdown', { x: 560, y: 370, target });
    await pointer(page, 'pointermove', { x: 580, y: 390 });
    await pointer(page, 'pointerup', { x: 580, y: 390 });
    await expect(desktop.locator('[data-cy="Part 1"]')).toHaveAttribute('width', '60');
    await expect(mobile.locator('[data-cy="Part 1"]')).toHaveAttribute('width', '60');
    await selectTool(page, 'Draws a rectangle or square');
    const surface = (await page.locator('svg#surface').boundingBox())!;
    await page.mouse.move(surface.x + 700, surface.y + 440);
    await page.mouse.down();
    await page.mouse.move(surface.x + 740, surface.y + 480, { steps: 4 });
    await page.mouse.up();
    await expect(navigation).toBeVisible();
    await expect(desktop.locator('[data-cy]')).toHaveCount(4);
    await expect(mobile.locator('[data-cy]')).toHaveCount(4);
    await navigation.getByRole('button', { name: 'Back to canvas' }).click();
    await expect(navigation).toHaveCount(0);
    await expect(desktop.locator('[data-component-selection="card"]')).toBeVisible();
});

test('opens an instance source in place, edits its master and returns to the instance', async ({
    page
}) => {
    const { desktop, mobile } = await openComponent(page, false, true);
    const instance = desktop.locator('[data-view-instance-hit]');
    await instance.click();
    await page
        .getByRole('list', { name: 'Commands' })
        .getByRole('button', { name: 'Select component source', exact: true })
        .click();
    const navigation = page.getByRole('navigation', { name: 'Component editing' });
    await expect(navigation).toContainText('Home · Desktop');
    await expect(desktop.locator('[data-view-instance-hit]')).toHaveCount(0);
    await page.getByRole('button', { name: 'More panels' }).click();
    await page.getByRole('checkbox', { name: 'Inspector', exact: true }).uncheck();
    await page.getByRole('button', { name: 'More panels' }).click();
    const surface = (await page.locator('svg#surface').boundingBox())!;
    await page.mouse.click(surface.x + 550, surface.y + 390);
    const target = '#screen-views > [data-screen-view="desktop"] [data-type="bottomRight"]';
    await pointer(page, 'pointerdown', { x: 580, y: 420, target });
    await pointer(page, 'pointermove', { x: 600, y: 440 });
    await pointer(page, 'pointerup', { x: 600, y: 440 });
    await expect(desktop.locator('[data-cy="Part 1"]')).toHaveAttribute('width', '60');
    await expect(mobile.locator('[data-cy="Part 1"]')).toHaveAttribute('width', '60');
    await selectTool(page, 'Type a text');
    await page.mouse.click(surface.x + 700, surface.y + 480);
    await page.keyboard.type('Caption');
    await page.keyboard.press('Enter');
    await expect(desktop.locator('text[data-cy^="text-"]')).toHaveText('Caption');
    await expect(mobile.locator('text[data-cy^="text-"]')).toHaveText('Caption');
    await navigation.getByRole('button', { name: 'Back to canvas' }).click();
    await expect(navigation).toHaveCount(0);
    await expect(desktop.locator('[data-view-instance-hit]')).toHaveCount(1);
    await expect(page.locator('[data-selection-badge]')).toHaveCSS('left', '540px');
});

test('Explorer child selection retains view focus and Escape returns to the original view', async ({
    page
}) => {
    const { desktop, mobile } = await openComponent(page, true);
    const navigation = await focusDesktop(page);
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const row = explorer
        .getByRole('button', { name: 'Home · Desktop', exact: true })
        .locator('xpath=ancestor::li[1]');
    await row.getByRole('button', { name: 'Part 2', exact: true }).click();
    await expect(navigation).toBeVisible();
    await expect(desktop.locator('[data-type="bottomRight"]')).toHaveAttribute('cx', '620');
    await page.setViewportSize({ width: 600, height: 850 });
    // Use the equal Mobile view while the Desktop placement is offscreen.
    await pointer(page, 'pointerdown', {
        x: 190,
        y: 120,
        target: '#screen-views > [data-screen-view="home:view"] [data-cy="Part 2"]'
    });
    await pointer(page, 'pointermove', { x: 210, y: 120 });
    await pointer(page, 'pointerup', { x: 210, y: 120 });
    await expect(mobile.locator('[data-cy="Part 2"]')).toHaveAttribute('x', '200');
    await expect(navigation).toContainText('Home · 300 px');
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.locator('svg#surface').focus();
    await page.keyboard.press('Escape');
    await expect(navigation).toHaveCount(0);
    await expect(page.getByRole('toolbar', { name: 'Selection menu' }).locator('..')).toHaveCSS(
        'left',
        '520px'
    );
});

async function openInstanceSource(page: Page, rotation = 0) {
    const views = await openComponent(page, true, true, rotation);
    await views.desktop.locator('[data-view-instance-hit]').click();
    await page
        .getByRole('list', { name: 'Commands' })
        .getByRole('button', { name: 'Select component source', exact: true })
        .click();

    return { ...views, navigation: page.getByRole('navigation', { name: 'Component editing' }) };
}

test('selecting a source-only child in the Explorer keeps editing in the view', async ({
    page
}) => {
    const { desktop, navigation } = await openInstanceSource(page);
    await expect(navigation).toContainText('Home · Desktop');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Part 1', exact: true })
        .click();
    await expect(navigation).toContainText('Home · Desktop');
    await expect(desktop.locator('[data-cy="Part 1"]')).toBeVisible();
    await expect(desktop.locator('[data-type="bottomRight"]')).toHaveCount(1);
});

test('the breadcrumb leaves out the view when a rotated instance opens the standalone editor', async ({
    page
}) => {
    const { navigation } = await openInstanceSource(page, 15);
    await expect(navigation).toContainText('Card');
    await expect(page.locator('#screen-views > g')).toHaveCount(0);
    await expect(navigation).not.toContainText('Home · Desktop');
});

test.describe('Screen view keyboard editing', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

    test('pastes, duplicates and nudges shared artwork in the active view', async ({ page }) => {
        const { desktop, mobile } = await openComponent(page);
        const surface = (await page.locator('svg#surface').boundingBox())!;
        await page.mouse.click(surface.x + 680, surface.y + 350);
        await page.keyboard.press('ControlOrMeta+c');
        await page.mouse.click(surface.x + 800, surface.y + 450);
        await page.keyboard.press('ControlOrMeta+v');
        const pasted = desktop.locator('[data-cy="Part 4"]');
        await expect(pasted).toHaveAttribute('x', '780');
        await expect(pasted).toHaveAttribute('y', '430');
        await expect(mobile.locator('[data-cy="Part 4"]')).toHaveAttribute('x', '380');
        await page.keyboard.press('ControlOrMeta+d');
        const clone = desktop.locator('[data-cy="rectangle-1"]');
        await expect(clone).toHaveAttribute('x', '790');
        await page.keyboard.press('ArrowRight');
        await expect(clone).toHaveAttribute('x', '800');
        await expect(mobile.locator('[data-cy="rectangle-1"]')).toHaveAttribute('x', '400');
        await page.keyboard.press('Delete');
        await expect(clone).toHaveCount(0);
        await expect(pasted).toBeVisible();
        await page.setViewportSize({ width: 600, height: 850 });
        await mobile.locator('[data-cy="Part 3"]').click();
        await page.keyboard.press('ControlOrMeta+c');
        await page.mouse.click(surface.x + 240, surface.y + 230);
        await page.keyboard.press('ControlOrMeta+v');
        await expect(mobile.locator('[data-cy="Part 5"]')).toHaveAttribute('x', '220');
        await expect(mobile.locator('[data-cy="Part 5"]')).toHaveAttribute('y', '210');
        await page.screenshot({ path: 'test-results/reactor-screen-view-keyboard-narrow.png' });
    });

    test('keeps duplicate and pasted children in focus, with shared undo and return behavior', async ({
        page
    }) => {
        const { desktop, mobile } = await openComponent(page, false, true);
        await desktop.locator('[data-view-instance-hit]').click();
        await page
            .getByRole('list', { name: 'Commands' })
            .getByRole('button', { name: 'Select component source', exact: true })
            .click();
        const navigation = page.getByRole('navigation', { name: 'Component editing' });
        await page.getByRole('button', { name: 'More panels' }).click();
        await page.getByRole('checkbox', { name: 'Inspector', exact: true }).uncheck();
        await page.getByRole('button', { name: 'More panels' }).click();
        const surface = (await page.locator('svg#surface').boundingBox())!;
        await page.mouse.click(surface.x + 550, surface.y + 390);
        await page.keyboard.press('ControlOrMeta+d');
        const clone = desktop.locator('[data-cy="rectangle-1"]');
        await expect(clone).toHaveAttribute('x', '550');
        await expect(navigation).toContainText('Home · Desktop');
        await page.keyboard.press('ArrowRight');
        await expect(clone).toHaveAttribute('x', '560');
        await page.keyboard.press('ControlOrMeta+c');
        await page.keyboard.press('ControlOrMeta+v');
        const pasted = desktop.locator('[data-cy="rectangle-2"]');
        await expect(pasted).toBeVisible();
        await expect(navigation).toContainText('Home · Desktop');
        await expect(mobile.locator('[data-cy="rectangle-2"]')).toBeVisible();
        await page.keyboard.press('ControlOrMeta+z');
        await expect(pasted).toHaveCount(0);
        await expect(clone).toBeVisible();
        await page.keyboard.press('ControlOrMeta+Shift+z');
        await expect(pasted).toBeVisible();
        await page.screenshot({ path: 'test-results/reactor-screen-view-keyboard.png' });
        await navigation.getByRole('button', { name: 'Back to canvas' }).click();
        await expect(navigation).toHaveCount(0);
        await expect(desktop.locator('[data-view-instance-hit]')).toHaveCount(1);
    });
});
