import { expect, test } from '@playwright/test';
import { createComponent, createDocument, createGroup, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { shapes } from './support/editor';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.beforeEach(async ({ page }) => {
    const shapes = ['Rectangle 1', 'Rectangle 2', 'Background', 'Border', 'Left', 'Right'].map(
        (name, index) =>
            createShape({
                type: 'rectangle',
                name,
                order: `a${index}`,
                position: { x: 300 + index * 40, y: 200 },
                size: { width: 30, height: 30 },
                selected: false
            })
    );
    const component = createComponent({
        name: 'Card',
        shapesIds: [shapes[2].id, shapes[3].id]
    });
    const instance = createShape({
        type: 'instance',
        name: 'Card copy',
        order: 'a6',
        componentId: component.id,
        position: { x: 300, y: 300 },
        overrides: {},
        selected: false
    });
    const group = createGroup({ name: 'Pair', shapesIds: [shapes[4].id, shapes[5].id] });
    const document = createDocument({
        shapes: Object.fromEntries([...shapes, instance].map((shape) => [shape.id, shape])),
        groups: { [group.id]: group },
        components: { [component.id]: component }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.goto('/');
    await page.getByRole('checkbox', { name: 'Explorer', exact: true }).check();
});

test('a normal Explorer click replaces selection and Shift-click toggles shapes and instances', async ({
    page
}) => {
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const first = explorer.getByRole('button', { name: 'Rectangle 1', exact: true });
    const second = explorer.getByRole('button', { name: 'Rectangle 2', exact: true });
    const instance = explorer.getByRole('button', { name: 'Card copy', exact: true });

    await first.click();
    await second.click();
    await expect(first).toHaveAttribute('aria-pressed', 'false');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await second.click();
    await expect(second).toHaveAttribute('aria-pressed', 'true');

    await first.click({ modifiers: ['Shift'] });
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await second.click({ modifiers: ['Shift'] });
    await expect(second).toHaveAttribute('aria-pressed', 'false');

    await instance.click();
    await expect(first).toHaveAttribute('aria-pressed', 'false');
    await expect(instance).toHaveAttribute('aria-pressed', 'true');
    await second.click({ modifiers: ['Shift'] });
    await expect(instance).toHaveAttribute('aria-pressed', 'true');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
});

test('object symbols identify selections in the Explorer, Inspector, and on the canvas', async ({
    page
}) => {
    await page.getByRole('checkbox', { name: 'Inspector', exact: true }).check();
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const inspector = page.locator('[data-panel="inspector"]');
    const badge = page.locator('[data-selection-badge]');
    const selections = [
        { name: 'Rectangle 1', type: 'rectangle' },
        { name: 'Pair', type: 'group' },
        { name: 'Card', type: 'component' },
        { name: 'Card copy', type: 'instance' },
        { name: 'Surface', type: 'surface' }
    ];

    for (const { name, type } of selections) {
        const item = explorer.getByRole('button', { name, exact: true });

        await expect(item.locator(`svg[data-object-type="${type}"]`)).toHaveCount(1);
        await item.click();
        await expect(inspector.locator(`header svg[data-object-type="${type}"]`)).toHaveCount(1);
        await expect(badge.locator(`svg[data-object-type="${type}"]`)).toHaveCount(1);
        await expect(badge).toContainText(name);

        if (type === 'rectangle') {
            const shapeBox = await page.locator('svg#surface rect[data-cy]').first().boundingBox();
            const badgeBox = await badge.boundingBox();

            expect(badgeBox!.y + badgeBox!.height).toBeLessThan(shapeBox!.y);
        }
    }

    await explorer.getByRole('button', { name: 'New layer' }).click();
    const layer = explorer.getByRole('button', { name: /^layer-\d+$/ }).first();
    const layerName = await layer.textContent();

    await expect(layer.locator('svg[data-object-type="layer"]')).toHaveCount(1);
    await layer.click();
    await expect(inspector.locator('header svg[data-object-type="layer"]')).toHaveCount(1);
    await expect(badge.locator('svg[data-object-type="layer"]')).toHaveCount(1);
    await expect(badge).toContainText(layerName ?? '');
});

test('component children support the same selection and Shift-click behavior', async ({ page }) => {
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const components = explorer
        .getByText('Components', { exact: true })
        .locator('xpath=ancestor::li[1]');
    const layers = explorer.getByText('Layers', { exact: true }).locator('xpath=ancestor::li[1]');
    const source = components.getByRole('button', { name: 'Card', exact: true });
    const first = components.getByRole('button', { name: 'Background', exact: true });
    const second = components.getByRole('button', { name: 'Border', exact: true });
    const outside = layers.getByRole('button', { name: 'Rectangle 1', exact: true });

    await source.click();
    await expect(source).toHaveAttribute('aria-pressed', 'true');
    await first.click();
    await expect(source).toHaveAttribute('aria-pressed', 'false');
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(second).toHaveAttribute('aria-pressed', 'false');

    await second.click({ modifiers: ['Shift'] });
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await first.click();
    await expect(second).toHaveAttribute('aria-pressed', 'false');
    await outside.click();
    await expect(first).toHaveAttribute('aria-pressed', 'false');

    await first.click({ modifiers: ['Shift'] });
    await expect(outside).toHaveAttribute('aria-pressed', 'true');
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await first.click({ modifiers: ['Shift'] });
    await expect(first).toHaveAttribute('aria-pressed', 'false');
    await expect(outside).toHaveAttribute('aria-pressed', 'true');
});

test('copying a component source pastes one instance', async ({ page }) => {
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Card', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+c');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(copied)).toMatchObject({
        shapes: [{ type: 'instance' }]
    });

    await page.keyboard.press('ControlOrMeta+v');
    await expect(shapes(page)).toHaveCount(8);
    await expect(explorer.getByRole('button', { name: 'Card', exact: true })).toHaveCount(2);
});

test('a group replaces selection unless Shift is held', async ({ page }) => {
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const shape = explorer.getByRole('button', { name: 'Rectangle 1', exact: true });
    const group = explorer.getByRole('button', { name: 'Pair', exact: true });
    const left = explorer.getByRole('button', { name: 'Left', exact: true });
    const right = explorer.getByRole('button', { name: 'Right', exact: true });

    await shape.click();
    await group.click();
    await expect(shape).toHaveAttribute('aria-pressed', 'false');
    await expect(left).toHaveAttribute('aria-pressed', 'true');
    await expect(right).toHaveAttribute('aria-pressed', 'true');
    await group.click();
    await expect(group).toHaveAttribute('aria-pressed', 'true');

    await shape.click({ modifiers: ['Shift'] });
    await group.click({ modifiers: ['Shift'] });
    await expect(shape).toHaveAttribute('aria-pressed', 'true');
    await expect(left).toHaveAttribute('aria-pressed', 'false');
    await expect(right).toHaveAttribute('aria-pressed', 'false');
});

test('a source has one bounding box with shared resize and rotate handles', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Inspector', exact: true }).uncheck();
    // Press the gap between Background and Border, not either shape.
    await page.mouse.click(415, 215);
    const selection = page.locator('[data-component-selection]');
    const handles = selection.locator('[data-handle]');
    await expect(selection).toHaveCount(1);
    await expect(handles).toHaveCount(9);
    await expect(page.locator('[data-handle][data-shape-id]')).toHaveCount(0);

    await page.mouse.move(415, 215);
    await page.mouse.down();
    await page.mouse.move(415, 245);
    await page.mouse.up();
    await expect(selection.locator('rect').first()).toHaveAttribute('y', '230');

    const corner = selection.locator('[data-type="bottomRight"]');
    await corner.hover();
    await page.mouse.down();
    await page.keyboard.down('Control');
    await page.mouse.move(520, 290);
    await page.mouse.up();
    await page.keyboard.up('Control');
    await expect(selection.locator('rect').first()).toHaveAttribute('width', '140');
    await expect(selection.locator('rect').first()).toHaveAttribute('height', '60');

    await selection.locator('[data-type="rotate"]').hover();
    await page.mouse.down();
    await page.mouse.move(550, 260);
    await page.mouse.up();
    const transform = await selection.getAttribute('transform');
    expect(transform?.match(/-?\d+(?:\.\d+)?/g)?.map(Number)).toEqual([
        expect.closeTo(90),
        expect.closeTo(450),
        expect.closeTo(260)
    ]);
});

test('entering a source replaces its shared handles with child handles', async ({ page }) => {
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const components = explorer
        .getByText('Components', { exact: true })
        .locator('xpath=ancestor::li[1]');
    await components.getByRole('button', { name: 'Card', exact: true }).click();
    await expect(page.locator('[data-handle][data-component-id]')).toHaveCount(9);
    await components.getByRole('button', { name: 'Background', exact: true }).click();
    await expect(page.locator('[data-handle][data-component-id]')).toHaveCount(0);
    await expect(page.locator('[data-handle][data-shape-id]')).toHaveCount(9);
});

test('the tree separates scene layers from component sources and focuses source editing', async ({
    page
}) => {
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const layers = explorer.getByText('Layers', { exact: true }).locator('xpath=ancestor::li[1]');
    const components = explorer
        .getByText('Components', { exact: true })
        .locator('xpath=ancestor::li[1]');

    await expect(layers.getByRole('button', { name: 'Card copy', exact: true })).toBeVisible();
    await expect(layers.getByRole('button', { name: 'Card', exact: true })).toHaveCount(0);
    await expect(components.getByRole('button', { name: 'Card', exact: true })).toBeVisible();
    await expect(components.getByRole('button', { name: 'Background', exact: true })).toBeVisible();

    await components.getByRole('button', { name: 'Card', exact: true }).dblclick();
    await expect(page.getByRole('navigation', { name: 'Component editing' })).toContainText('Card');
    await expect(page.locator('svg#surface #shapes > g')).toHaveCount(2);
    await page.getByRole('button', { name: 'Back to canvas' }).click();
    await expect(page.locator('svg#surface #shapes > g')).toHaveCount(7);
});
