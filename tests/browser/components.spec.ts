import { expect, test } from '@playwright/test';
import { drawRect, openEditor, pointer, selectTool, shapes } from './support/editor';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';

test('places and reloads a live component instance', async ({ page }) => {
    await openEditor(page, ['Components']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const panel = page.getByRole('region', { name: 'Components' });
    await panel.getByRole('button', { name: 'Create component' }).click();
    await expect(panel.getByRole('button', { name: 'Insert' })).toBeVisible();

    await panel.getByRole('button', { name: 'Insert' }).click();
    await pointer(page, 'pointerdown', { x: 250, y: 250 });
    await pointer(page, 'pointerup', { x: 250, y: 250 });

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

test('an exposed fill changes one instance without changing its source', async ({ page }) => {
    await openEditor(page, ['Components', 'Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    const panel = page.getByRole('region', { name: 'Components' });

    await panel.getByRole('button', { name: 'Create component' }).click();
    await panel.getByRole('combobox', { name: /Property to expose/ }).selectOption({
        label: 'rectangle-1: Fill'
    });
    await panel.getByRole('button', { name: 'Expose property' }).click();
    await panel.getByRole('button', { name: 'Insert' }).click();
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
    await properties.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect.poll(() => fill(1)).toBe(original);
    await page.getByLabel('rectangle-1: Fill', { exact: true }).fill('#0000ff');
    await expect.poll(() => fill(1)).toBe('rgb(0, 0, 255)');
    await panel.getByRole('button', { name: 'Remove property', exact: true }).click();
    await expect(properties).toHaveCount(0);
    await expect.poll(() => fill(1)).toBe(original);
});

for (const visible of [true, false]) {
    test(`visibility overrides work with a ${visible ? 'visible' : 'hidden'} source`, async ({
        page
    }) => {
        await openEditor(page, ['Components', 'Inspector']);
        await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
        const panel = page.getByRole('region', { name: 'Components' });
        await panel.getByRole('button', { name: 'Create component' }).click();
        await panel.getByRole('combobox', { name: /Property to expose/ }).selectOption({
            label: 'rectangle-1: Visible'
        });
        await panel.getByRole('button', { name: 'Expose property' }).click();
        if (!visible) {
            await page.getByRole('checkbox', { name: 'Visible', exact: true }).click();
        }
        await panel.getByRole('button', { name: 'Insert', exact: true }).click();
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
