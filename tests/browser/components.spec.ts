import { expect, test, type Locator } from '@playwright/test';
import { drawRect, openEditor, pointer, selectTool, shapes } from './support/editor';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';

const editComponent = async (panel: Locator) => {
    await panel.getByLabel('More inspector actions').click();
    await panel.getByRole('button', { name: 'Edit component' }).click();
};

test('the Inspector header renames a component source without a duplicate Name field', async ({
    page
}) => {
    await openEditor(page, ['Explorer', 'Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Create component', exact: true }).click();

    const panel = page.locator('[data-panel="inspector"]');
    const name = panel.getByRole('textbox', { name: 'Name', exact: true });
    await expect(name).toHaveCount(1);
    await name.fill('Card');
    await name.press('Enter');
    await expect(name).not.toBeFocused();
    await expect(explorer.getByRole('button', { name: 'Card', exact: true })).toBeVisible();
    await expect(panel.getByRole('columnheader', { name: 'Identity' })).toHaveCount(0);
});

test('a long component breadcrumb stays within the Inspector', async ({ page }) => {
    await openEditor(page, ['Explorer', 'Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Create component', exact: true }).click();
    await explorer
        .getByText('Components', { exact: true })
        .locator('xpath=ancestor::li[1]')
        .getByRole('button', { name: 'component-1', exact: true })
        .click();

    const panel = page.locator('[data-panel="inspector"]');
    const name = `Component-${'a'.repeat(200)}`;
    await panel.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
    await panel.getByRole('textbox', { name: 'Name', exact: true }).press('Enter');
    await explorer.getByRole('button', { name: 'rectangle-1' }).click();

    const breadcrumb = panel.getByRole('navigation', { name: 'Component hierarchy' });
    const link = breadcrumb.getByRole('button', { name: `Select ${name} source` });
    const linkBox = (await link.boundingBox())!;
    const panelBox = (await panel.boundingBox())!;
    expect(linkBox.x).toBeGreaterThanOrEqual(panelBox.x);
    expect(linkBox.x + linkBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
    expect(await link.locator('span').evaluate((element) => element.scrollWidth)).toBeGreaterThan(
        await link.locator('span').evaluate((element) => element.clientWidth)
    );
    await link.click();
    await expect(panel.getByRole('region', { name: 'Component source' })).toBeVisible();
});

test('places and reloads a live component instance', async ({ page }) => {
    await openEditor(page, ['Explorer', 'Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Create component', exact: true }).click();
    const sources = explorer
        .getByText('Components', { exact: true })
        .locator('xpath=ancestor::li[1]');
    await expect(sources.getByRole('button', { name: /^component-\d+$/ })).toBeVisible();
    await sources.getByRole('button', { name: 'Collapse component-1' }).click();
    await expect(explorer.getByRole('button', { name: 'rectangle-1' })).toHaveCount(0);
    await sources.getByRole('button', { name: 'Expand component-1' }).click();
    await expect(explorer.getByRole('button', { name: 'rectangle-1' })).toBeVisible();
    await sources.getByRole('button', { name: 'component-1', exact: true }).click();

    await page
        .getByRole('region', { name: 'Component source' })
        .getByRole('button', {
            name: 'Place instance'
        })
        .click();
    await pointer(page, 'pointerdown', { x: 250, y: 250 });
    await pointer(page, 'pointerup', { x: 250, y: 250 });

    const inspector = page.getByRole('region', { name: 'Component properties' });
    const empty = inspector.getByText('No editable properties yet.');
    await expect(empty).toBeVisible();
    const regionBox = (await inspector.boundingBox())!;
    const emptyBox = (await empty.boundingBox())!;
    expect(emptyBox.x).toBeGreaterThan(regionBox.x);
    expect(emptyBox.x + emptyBox.width).toBeLessThan(regionBox.x + regionBox.width);
    const panel = page.locator('[data-panel="inspector"]');
    const nameBox = (await panel.getByRole('textbox', { name: 'Name' }).boundingBox())!;
    const actionBox = (await panel.getByLabel('More inspector actions').boundingBox())!;
    expect(Math.abs(nameBox.y - actionBox.y)).toBeLessThan(8);
    const layout = page
        .getByRole('columnheader', { name: 'Layout' })
        .locator('xpath=ancestor::tbody[1]');
    const layoutWidth = (await layout.boundingBox())?.width ?? 0;
    const tableWidth = (await layout.locator('xpath=ancestor::table[1]').boundingBox())?.width ?? 0;
    expect(layoutWidth).toBeGreaterThan(tableWidth * 0.9);
    const rotationWidth =
        (await layout.locator('tr[data-property="rotation"]').boundingBox())?.width ?? 0;
    expect(rotationWidth).toBeGreaterThan(layoutWidth * 0.9);
    await expect(page.getByText('Selected', { exact: true })).toHaveCount(0);

    await expect(shapes(page)).toHaveCount(2);
    await expect(shapes(page).last().locator('rect[data-cy]')).toBeVisible();
    const before = await shapes(page).last().locator('rect[data-cy]').boundingBox();

    await selectTool(page, 'Selects shapes and groups ');
    await pointer(page, 'pointerdown', { x: 125, y: 125 });
    await pointer(page, 'pointermove', { x: 145, y: 125 });
    await pointer(page, 'pointerup', { x: 145, y: 125 });
    const after = await shapes(page).last().locator('rect[data-cy]').boundingBox();
    expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);
    expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);

    await page.reload();
    await expect(shapes(page)).toHaveCount(2);
    await expect(shapes(page).last().locator('rect[data-cy]')).toBeVisible();
});

test('instance fields stay usable at default and minimum panel widths', async ({ page }) => {
    const rectangle = createShape({
        type: 'rectangle',
        name: 'Source',
        order: 'a0',
        position: { x: 100, y: 100 },
        size: { width: 50, height: 50 }
    });
    const component = createComponent({ shapesIds: [rectangle.id] });
    const instance = createShape({
        type: 'instance',
        name: 'Instance',
        overrides: {},
        order: 'a1',
        componentId: component.id,
        position: { x: 300, y: 300 },
        bindings: { visible: 'show', locked: 'lock' }
    });
    const document = createDocument({
        shapes: { [rectangle.id]: rectangle, [instance.id]: instance },
        components: { [component.id]: component },
        variables: {
            show: { id: 'show', name: 'Show details', type: 'boolean', values: { default: true } },
            lock: {
                id: 'lock',
                name: 'Prevent accidental edits',
                type: 'boolean',
                values: { default: false }
            }
        }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector']);
    await pointer(page, 'pointerdown', { x: 325, y: 325 });
    await pointer(page, 'pointerup', { x: 325, y: 325 });

    const panel = page.locator('[data-panel="inspector"]');
    const resize = page.getByRole('button', { name: /^Resize Inspector/ }).last();
    const x = panel.getByRole('spinbutton', { name: 'X', exact: true });
    const y = panel.getByRole('spinbutton', { name: 'Y', exact: true });
    const show = panel.getByRole('button', { name: 'Hide', exact: true });
    const lock = panel.getByRole('button', { name: 'Lock', exact: true });

    for (const width of [260, 160]) {
        await expect.poll(async () => (await panel.boundingBox())!.width).toBe(width);
        const panelBox = (await panel.boundingBox())!;
        const rotation = panel.locator('tr[data-property="rotation"]');
        await expect(rotation).toBeVisible();
        for (const control of [show, lock, panel.getByLabel('More inspector actions')]) {
            const box = (await control.boundingBox())!;
            expect(box.width).toBeGreaterThan(0);
            expect(box.x).toBeGreaterThanOrEqual(panelBox.x);
            expect(box.x + box.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
        }
        const xBox = (await x.boundingBox())!;
        const yBox = (await y.boundingBox())!;
        expect(xBox.width).toBeGreaterThan(50);
        if (width === 160) {
            expect(yBox.y).toBeGreaterThan(xBox.y);
            continue;
        }
        expect(xBox.y).toBe(yBox.y);
        await resize.focus();
        for (let step = 0; step < 10; step += 1) {
            await resize.press('ArrowLeft');
        }
    }
    await expect(show).toBeDisabled();
    await expect(lock).toBeDisabled();
    await panel.getByLabel('More inspector actions').click();
    await expect(panel.getByLabel('Visible variable')).toHaveValue('show');
    await expect(panel.getByLabel('Locked variable')).toHaveValue('lock');
    await panel.getByLabel('Visible variable').selectOption('');
    await panel.getByLabel('Locked variable').selectOption('');
    await expect(show).toBeEnabled();
    await expect(lock).toBeEnabled();
});

test('component navigation works with Explorer closed and Escape leaves text editing alone', async ({
    page
}) => {
    await openEditor(page, ['Explorer', 'Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Create component', exact: true }).click();
    await editComponent(page.locator('[data-panel="inspector"]'));
    await page
        .getByRole('region', { name: 'Component source' })
        .getByRole('button', { name: 'Place instance' })
        .click();
    await pointer(page, 'pointerdown', { x: 250, y: 250 });
    await pointer(page, 'pointerup', { x: 250, y: 250 });
    const name = page
        .locator('[data-panel="inspector"]')
        .getByRole('textbox', { name: 'Name', exact: true });
    await name.fill('Second instance');
    await name.press('Enter');
    await editComponent(page.locator('[data-panel="inspector"]'));

    const navigation = page.getByRole('navigation', { name: 'Component editing' });
    await expect(navigation).toContainText('component-1');
    const navigationBox = (await navigation.boundingBox())!;
    const commandsBox = (await page.getByRole('list', { name: 'Commands' }).boundingBox())!;
    expect(navigationBox.y + navigationBox.height).toBeLessThan(commandsBox.y);
    await expect(explorer.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0);
    const search = explorer.getByRole('searchbox');
    await search.focus();
    await search.press('Escape');
    await expect(navigation).toBeVisible();

    await page.getByRole('checkbox', { name: 'Explorer', exact: true }).uncheck();
    await navigation.getByRole('button', { name: 'Back to canvas' }).click();
    await expect(navigation).toHaveCount(0);
    await expect(name).toHaveValue('Second instance');

    await editComponent(page.locator('[data-panel="inspector"]'));
    await page.keyboard.press('Escape');
    await expect(navigation).toHaveCount(0);
    await expect(name).toHaveValue('Second instance');
});

test('an exposed fill changes one instance without changing its source', async ({ page }) => {
    await openEditor(page, ['Explorer', 'Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    const explorer = page.getByRole('region', { name: 'Explorer' });

    await explorer.getByRole('button', { name: 'Create component', exact: true }).click();
    await explorer.getByRole('button', { name: 'rectangle-1' }).click();
    const exposeFill = page.getByRole('button', { name: 'Expose Fill to instances' });
    const fillIcon = exposeFill.locator('svg');
    await expect.poll(async () => (await fillIcon.boundingBox())!.width).toBe(16);
    await fillIcon.click();
    const stopExposing = page.getByRole('button', { name: 'Stop exposing Fill', exact: true });
    const exposureStatus = page.getByText('Editable properties', { exact: true });
    await expect(stopExposing).toHaveAttribute('aria-pressed', 'true');
    await expect(exposureStatus).toBeVisible();
    await stopExposing.click();
    await expect(exposureStatus).toHaveCount(0);
    await expect(exposeFill).toHaveAttribute('aria-pressed', 'false');
    await exposeFill.click();
    await expect(exposureStatus).toBeVisible();
    await page.getByRole('button', { name: /Select component-\d+ source/ }).click();
    await page
        .getByRole('region', { name: 'Component source' })
        .getByRole('button', {
            name: 'Place instance'
        })
        .click();
    await pointer(page, 'pointerdown', { x: 250, y: 250 });
    await pointer(page, 'pointerup', { x: 250, y: 250 });

    const fill = (index: number) =>
        shapes(page)
            .nth(index)
            .locator('rect[data-cy]')
            .evaluate((element) => getComputedStyle(element).fill);
    const original = await fill(0);
    await page.getByLabel('rectangle-1: Fill', { exact: true }).fill('#ff0000');
    await expect.poll(() => fill(1)).toBe('rgb(255, 0, 0)');
    expect(await fill(0)).toBe(original);

    const properties = page.getByRole('region', { name: 'Component properties' });
    await expect(properties.getByRole('heading', { name: 'rectangle-1' })).toBeVisible();
    await expect(properties.getByText('1 changed')).toBeVisible();
    await properties
        .getByRole('button', { name: 'Reset rectangle-1: Fill to source value' })
        .click();
    await expect(properties.getByText('All from source')).toBeVisible();
    await expect.poll(() => fill(1)).toBe(original);
    await page.getByLabel('rectangle-1: Fill', { exact: true }).fill('#0000ff');
    await expect.poll(() => fill(1)).toBe('rgb(0, 0, 255)');
    await editComponent(page.locator('[data-panel="inspector"]'));
    await page
        .getByRole('region', { name: 'Component source' })
        .getByRole('button', {
            name: 'Stop exposing rectangle-1: Fill'
        })
        .click();
    await expect(properties).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to canvas' }).click();
    await expect.poll(() => fill(1)).toBe(original);
});

for (const visible of [true, false]) {
    test(`visibility overrides work with a ${visible ? 'visible' : 'hidden'} source`, async ({
        page
    }) => {
        await openEditor(page, ['Explorer', 'Inspector']);
        await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
        const explorer = page.getByRole('region', { name: 'Explorer' });
        await explorer.getByRole('button', { name: 'Create component', exact: true }).click();
        await explorer.getByRole('button', { name: 'rectangle-1' }).click();
        await page.locator('[data-panel="inspector"]').getByLabel('More inspector actions').click();
        await page.getByRole('button', { name: 'Expose Visible to instances' }).click();
        if (!visible) {
            await page
                .locator('[data-panel="inspector"]')
                .getByRole('button', { name: 'Hide', exact: true })
                .click();
        }
        const sources = explorer
            .getByText('Components', { exact: true })
            .locator('xpath=ancestor::li[1]');
        await sources.getByRole('button', { name: /^component-\d+$/ }).click();
        await page
            .getByRole('region', { name: 'Component source' })
            .getByRole('button', {
                name: 'Place instance'
            })
            .click();
        await pointer(page, 'pointerdown', { x: 250, y: 250 });
        await pointer(page, 'pointerup', { x: 250, y: 250 });

        const field = page.getByRole('checkbox', { name: 'rectangle-1: Visible', exact: true });
        const member = shapes(page).last().locator('rect[data-cy]');
        await field.setChecked(!visible);
        await expect(member).toHaveCount(visible ? 0 : 1);
        await field.setChecked(visible);
        await expect(member).toHaveCount(visible ? 1 : 0);
    });
}

test('an instance selection follows text bounds measured after the first render', async ({
    page
}) => {
    const label = createShape({
        type: 'text',
        order: 'a1',
        name: 'Source label',
        position: { x: 100, y: 100 },
        value: 'Measured text',
        fontSize: 24
    });
    const component = createComponent({ shapesIds: [label.id] });
    // Draw the instance first so it initially uses the source's analytic bounds.
    const instance = createShape({
        type: 'instance',
        name: 'Instance',
        order: 'a0',
        componentId: component.id,
        position: { x: 300, y: 300 },
        overrides: {}
    });
    const document = createDocument({
        shapes: { [label.id]: label, [instance.id]: instance },
        components: { [component.id]: component }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page);
    const text = shapes(page).first().locator('text[data-cy]');
    await expect(text).toBeVisible();
    const bounds = (await text.boundingBox())!;
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    const selection = shapes(page).first().locator(':scope > rect');
    await expect(selection).toHaveCount(1);
    await expect
        .poll(() =>
            selection.evaluate((element) => {
                const content = element.parentElement?.querySelector(':scope > g');
                if (
                    !(element instanceof SVGRectElement) ||
                    !(content instanceof SVGGraphicsElement)
                ) {
                    throw new Error('Expected the instance content and selection rectangle');
                }
                // Compare local geometry, excluding the selection rectangle's stroke.
                const box = element.getBBox();
                const drawn = content.getBBox();

                return Math.max(
                    ...(['x', 'y', 'width', 'height'] as const).map((key) =>
                        Math.abs(box[key] - drawn[key])
                    )
                );
            })
        )
        .toBeLessThan(0.1);
});

test('nested instance opacity and its exposed override affect rendering', async ({ page }) => {
    const rectangle = createShape({
        type: 'rectangle',
        name: 'Source',
        order: 'a0',
        position: { x: 0, y: 0 },
        size: { width: 40, height: 40 },
        fill: '#ff0000'
    });
    const leaf = createComponent({ shapesIds: [rectangle.id] });
    const nested = createShape({
        type: 'instance',
        name: 'Nested',
        order: 'a1',
        componentId: leaf.id,
        position: { x: 100, y: 100 },
        overrides: {},
        opacity: 0.5
    });
    const outer = createComponent({
        shapesIds: [nested.id],
        props: [{ id: 'opacity', shapeId: nested.id, key: 'opacity', label: 'Nested opacity' }]
    });
    const instance = createShape({
        type: 'instance',
        name: 'Outer instance',
        order: 'a2',
        componentId: outer.id,
        position: { x: 300, y: 300 },
        overrides: {}
    });
    const document = createDocument({
        shapes: { [rectangle.id]: rectangle, [nested.id]: nested, [instance.id]: instance },
        components: { [leaf.id]: leaf, [outer.id]: outer }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector']);
    const drawn = shapes(page).last();
    const opacity = () =>
        drawn.locator('rect[data-cy]').evaluate((element) => {
            let value = 1;
            let parent = element.parentElement;

            while (parent instanceof SVGElement) {
                value *= Number(getComputedStyle(parent).opacity);
                parent = parent.parentElement;
            }

            return value;
        });
    await expect.poll(opacity).toBeCloseTo(0.5);
    const bounds = (await drawn.locator('rect[data-cy]').boundingBox())!;
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.getByLabel('Nested opacity', { exact: true }).fill('20');
    await expect.poll(opacity).toBeCloseTo(0.2);
});
