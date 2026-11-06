import { expect, test } from '@playwright/test';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';
import { selectVariable, variablesPanel } from './support/variables';

// Screen view shapes skip rendering when their projected fields are unchanged.
// A variable edit leaves those fields alone, so every view must still repaint.
test('every Screen view repaints its artwork and instances when a color variable changes', async ({
    page
}) => {
    const part = createShape({
        type: 'rectangle',
        name: 'Card part',
        order: 'a0',
        position: { x: 0, y: 0 },
        size: { width: 40, height: 40 },
        fill: '#3366ff',
        bindings: { fill: 'brand' },
        selected: false
    });
    const plain = createShape({
        type: 'rectangle',
        name: 'Banner',
        order: 'a1',
        parentFrameId: 'home',
        position: { x: 100, y: 100 },
        size: { width: 60, height: 30 },
        fill: '#3366ff',
        bindings: { fill: 'brand' },
        selected: false
    });
    const instance = createShape({
        type: 'instance',
        name: 'Card instance',
        order: 'a2',
        componentId: 'card',
        parentFrameId: 'home',
        overrides: {},
        position: { x: 200, y: 100 },
        selected: false
    });
    const fixture = createDocument({
        id: 'view-repaint',
        shapes: Object.fromEntries([part, plain, instance].map((shape) => [shape.id, shape])),
        components: {
            card: createComponent({
                id: 'card',
                name: 'Card',
                sourceOnly: true,
                shapesIds: [part.id]
            })
        },
        variables: {
            brand: { id: 'brand', name: 'brand', type: 'color', values: { default: '#3366ff' } }
        },
        frames: {
            home: {
                id: 'home',
                name: 'Home',
                kind: 'screen',
                definitionOnly: true,
                position: { x: 80, y: 80 },
                size: { width: 300, height: 200 },
                visible: true,
                locked: false
            },
            ...Object.fromEntries(
                [0, 1].map((index) => [
                    `view${index}`,
                    {
                        id: `view${index}`,
                        name: `View ${index}`,
                        kind: 'view' as const,
                        screenId: 'home',
                        position: { x: 80 + index * 360, y: 80 },
                        size: { width: 300, height: 200 },
                        visible: true,
                        locked: false
                    }
                ])
            )
        }
    });
    const saved = serializePersistedState({
        currentDocumentId: fixture.id,
        documents: { [fixture.id]: fixture }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Variables']);

    const fills = () =>
        page
            .locator('#screen-views [data-screen-view^="view"] rect[data-cy]')
            .evaluateAll((nodes) =>
                nodes.map((node) => [
                    node.closest('[data-screen-view]')!.getAttribute('data-screen-view'),
                    node.getAttribute('data-cy'),
                    getComputedStyle(node).fill
                ])
            );
    const expected = (fill: string) =>
        ['view0', 'view1'].flatMap((view) => [
            [view, 'Banner', fill],
            [view, 'Card part', fill]
        ]);
    const sorted = async () => (await fills()).map((row) => row.join('|')).sort();
    const rows = (fill: string) =>
        expected(fill)
            .map((row) => row.join('|'))
            .sort();

    await expect.poll(sorted).toEqual(rows('rgb(51, 102, 255)'));

    await selectVariable(page, 'brand');
    await variablesPanel(page).getByLabel('Value of brand', { exact: true }).fill('#ff0000');

    await expect.poll(sorted).toEqual(rows('rgb(255, 0, 0)'));
});
