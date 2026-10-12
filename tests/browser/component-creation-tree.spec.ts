import { expect, test } from '@playwright/test';
import { createDocument, createLayer, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('creating a component leaves an instance in Layers and opens its source in Components', async ({
    page
}) => {
    const shape = createShape({
        type: 'rectangle',
        name: 'Artwork',
        order: 'a0',
        position: { x: 300, y: 200 },
        size: { width: 40, height: 30 }
    });
    const layer = createLayer({
        id: 'artwork-layer',
        name: 'Artwork layer',
        shapesIds: [shape.id]
    });
    const document = createDocument({
        shapes: { [shape.id]: shape },
        layers: { [layer.id]: layer }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });

    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.goto('/');
    await page.getByRole('checkbox', { name: 'Explorer', exact: true }).check();

    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Artwork', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+Alt+c');

    const layers = explorer
        .getByRole('button', { name: 'Canvas', exact: true })
        .locator('xpath=ancestor::li[1]');
    const components = explorer
        .getByText('Components', { exact: true })
        .locator('xpath=ancestor::li[1]');
    await expect(layers.getByRole('button', { name: 'Artwork', exact: true })).toHaveCount(0);
    await expect(layers.getByRole('button', { name: 'component-1', exact: true })).toBeVisible();
    await expect(components.getByRole('button', { name: 'Artwork', exact: true })).toBeVisible();
    await expect(page.locator('svg#surface #shapes > g')).toHaveCount(1);

    await components.getByRole('button', { name: 'component-1', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Component editing' })).toContainText(
        'component-1'
    );
    await expect(page.locator('svg#surface #shapes > g')).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+c');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(copied)).toMatchObject({ shapes: [{ type: 'instance' }] });
    await page.getByRole('button', { name: 'Back to canvas' }).click();
    await expect(layers.getByRole('button', { name: 'component-1', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
});
