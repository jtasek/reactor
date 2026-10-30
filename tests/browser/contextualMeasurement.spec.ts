import { selectVariable } from './support/variables';
import { expect, test, type Page } from '@playwright/test';
import { createDocument, createShape, createComponent } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';
import type { Frame } from 'src/app/types';

async function openMeasurement(page: Page) {
    const text = createShape({
        type: 'text',
        name: 'Greeting',
        order: 'a0',
        position: { x: 0, y: 20 },
        value: 'Hello',
        fontSize: 20,
        wrapWidth: 110,
        bindings: { text: 'copy', fontSize: 'font' }
    });
    text.id = 'text';
    const instance = createShape({
        type: 'instance',
        name: 'Label instance',
        order: 'a1',
        position: { x: 130, y: 120 },
        componentId: 'label',
        overrides: {},
        parentFrameId: 'screen'
    });
    instance.id = 'instance';
    const frame = (id: string, x: number): Frame => ({
        id,
        name: id,
        kind: 'view',
        screenId: 'screen',
        position: { x, y: 100 },
        size: { width: 300, height: 300 },
        visible: true,
        locked: false
    });
    const document = createDocument({
        id: 'measurement',
        name: 'Contextual text',
        dimensions: {
            density: {
                id: 'density',
                name: 'Density',
                order: 0,
                defaultModeId: 'small',
                modes: {
                    small: { id: 'small', name: 'Small', order: 0 },
                    large: { id: 'large', name: 'Large', order: 1 }
                }
            }
        },
        variables: {
            font: {
                id: 'font',
                name: 'Font size',
                type: 'number',
                dimensionId: 'density',
                values: { default: 20, large: 32 }
            },
            copy: {
                id: 'copy',
                name: 'Greeting',
                type: 'text',
                dimensionId: 'density',
                values: { default: 'Hello', large: 'Welcome to your workspace' }
            }
        },
        frames: {
            screen: {
                ...frame('screen', 100),
                name: 'Home',
                kind: 'screen',
                screenId: undefined,
                definitionOnly: true
            },
            small: frame('small', 100),
            large: { ...frame('large', 500), modeOverrides: { density: 'large' } }
        },
        shapes: { text, instance },
        shapesIds: ['text', 'instance'],
        components: {
            label: createComponent({
                id: 'label',
                name: 'Label',
                shapesIds: ['text'],
                sourceOnly: true
            })
        }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await page.setViewportSize({ width: 1400, height: 900 });
    await openEditor(page, ['Inspector']);
    await page.getByRole('button', { name: 'More panels' }).click();

    return {
        small: page.locator('#screen-views > [data-screen-view="small"]'),
        large: page.locator('#screen-views > [data-screen-view="large"]')
    };
}

test('draws different measured text per view and selects the full wrapped instance', async ({
    page
}) => {
    const { small, large } = await openMeasurement(page);
    await expect(small.locator('text[data-cy="Greeting"]')).toHaveText('Hello');
    await expect(large.locator('text[data-cy="Greeting"]')).toHaveCSS('font-size', '32px');
    expect(await large.locator('text[data-cy="Greeting"] tspan').count()).toBeGreaterThan(1);
    const smallHit = await small.locator('[data-view-instance-hit]').boundingBox();
    const largeHit = await large.locator('[data-view-instance-hit]').boundingBox();
    expect(largeHit!.height).toBeGreaterThan(smallHit!.height);
    await page.mouse.click(largeHit!.x + 10, largeHit!.y + largeHit!.height - 4);
    await expect(
        page.locator('[data-panel="inspector"]').getByLabel('Name', { exact: true })
    ).toHaveValue('Label instance');
    const visibleBounds = await large.locator('text[data-cy="Greeting"]').evaluate((node) => {
        const box = (node as SVGGraphicsElement).getBBox();
        return { width: box.width, height: box.height };
    });
    expect(Math.abs(visibleBounds.height - largeHit!.height)).toBeLessThan(1);
    await page.screenshot({ path: 'test-results/reactor-contextual-measurement.png' });
    await page.reload();
    await expect(large.locator('text[data-cy="Greeting"]')).toHaveCSS('font-size', '32px');
    await expect(small.locator('text[data-cy="Greeting"]')).toHaveText('Hello');
    const lines = await large.locator('text[data-cy="Greeting"] tspan').allTextContents();
    await page.locator('#frames > [data-frame="large"]').press('Enter');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const runtime = page.frameLocator('iframe[title="Application preview"]');
    await expect(runtime.locator('text[font-size="32"]')).toHaveCount(lines.length);
    expect(await runtime.locator('text[font-size="32"]').allTextContents()).toEqual(lines);
});

test('authors text modes and wrapping with usable narrow controls', async ({ page }) => {
    const { large } = await openMeasurement(page);
    await page.getByRole('button', { name: 'More panels' }).click();
    await page.getByRole('checkbox', { name: 'Variables', exact: true }).check();
    await page.getByRole('button', { name: 'More panels' }).click();
    await selectVariable(page, 'Greeting');
    const input = page.getByLabel('Large value of Greeting', { exact: true });
    await input.fill('Good morning');
    await input.blur();
    await expect(large.locator('text[data-cy="Greeting"]')).toHaveText('Good morning');
    await page.setViewportSize({ width: 600, height: 900 });
    await expect(input).toBeVisible();
    const reset = page.getByRole('button', {
        name: 'Actions for Large value of Greeting',
        exact: true
    });
    await expect
        .poll(async () => {
            const bounds = await reset.boundingBox();

            return bounds!.x + bounds!.width;
        })
        .toBeLessThanOrEqual(600);
    await page.screenshot({ path: 'test-results/reactor-contextual-measurement-narrow.png' });
});
