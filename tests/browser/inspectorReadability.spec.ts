import { expect, test } from '@playwright/test';
import { previewFixture } from '../support/preview';
import { createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

test('long component labels do not overlap values and help stays out of the editing flow', async ({
    page
}, testInfo) => {
    const document = previewFixture();
    document.components.input.props![0].label = 'Placeholder';
    const instance = document.shapes.name;
    if (instance.type !== 'instance') {
        throw new Error('Invalid fixture');
    }
    instance.overrides.label = 'What do you need?';
    instance.interaction = {
        role: 'input',
        props: { label: 'label', value: 'label' },
        controlId: 'request'
    };
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await openEditor(page, ['Inspector', 'Explorer']);
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Name field', exact: true })
        .click();
    const panel = page.locator('[data-panel="inspector"]');
    const properties = page.getByRole('region', { name: 'Component properties', exact: true });
    const input = properties.getByRole('textbox', { name: 'Placeholder', exact: true });
    const label = properties.locator('label[for="component-prop-label"]');
    const help = panel
        .locator('details')
        .filter({ has: page.getByText('About prototype behavior', { exact: true }) });
    await expect(help).not.toHaveAttribute('open', '');
    await expect(
        panel.getByText('Use the same identity and value property in another layout', {
            exact: false
        })
    ).toHaveCount(0);
    await expect(properties.getByText('Changed', { exact: true })).toHaveCount(0);
    await expect(properties).toContainText('1 changed');
    expect((await properties.boundingBox())!.y).toBeLessThan(
        (await page.getByRole('region', { name: 'Semantic role', exact: true }).boundingBox())!.y
    );
    const resize = page.getByRole('button', { name: /^Resize Inspector/ }).last();
    for (const width of [260, 160]) {
        await input.scrollIntoViewIfNeeded();
        await expect.poll(async () => (await panel.boundingBox())!.width).toBe(width);
        const headingBox = (await properties
            .getByRole('heading', { name: 'Properties', exact: true })
            .boundingBox())!;
        const statusBox = (await properties.getByText('1 changed', { exact: true }).boundingBox())!;
        expect(
            statusBox.y >= headingBox.y + headingBox.height ||
                statusBox.x >= headingBox.x + headingBox.width
        ).toBe(true);
        const labelBox = (await label.boundingBox())!;
        const inputBox = (await input.boundingBox())!;
        const panelBox = (await panel.boundingBox())!;
        expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(inputBox.y);
        expect(inputBox.width).toBeGreaterThan(50);
        expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
        await input.fill(`Edited at ${width}`);
        await expect(input).toHaveValue(`Edited at ${width}`);
        await page.screenshot({ path: testInfo.outputPath(`inspector-${width}.png`) });
        if (width === 260) {
            await resize.focus();
            for (let step = 0; step < 10; step += 1) {
                await resize.press('ArrowLeft');
            }
        }
    }
    await properties.getByRole('button', { name: 'Reset Placeholder to source value' }).click();
    await expect(input).toHaveValue('Your name');
    await expect(
        properties.getByRole('button', { name: 'Reset Placeholder to source value' })
    ).toHaveCount(0);
    await panel.getByText('About prototype behavior', { exact: true }).click();
    await expect(help).toHaveAttribute('open', '');
    await expect(help).toContainText('Each identity must be unique');
});

test('every exposed child keeps a heading once any heading is needed', async ({ page }) => {
    const document = previewFixture();
    const extra = (id: string, name: string, order: string) => ({
        ...createShape({ type: 'text', name, order, value: name, position: { x: 0, y: 48 } }),
        id,
        selected: false
    });
    document.shapes.hint = extra('hint', 'Hint', 'a5');
    document.shapes.note = extra('note', 'Note', 'a6');
    const input = document.components.input;
    input.shapesIds = ['field', 'hint', 'note'];
    input.props = [
        { id: 'label', shapeId: 'field', key: 'text', label: 'Field label: Text' },
        { id: 'hintText', shapeId: 'hint', key: 'text', label: 'Hint: Text' },
        { id: 'noteSize', shapeId: 'note', key: 'fontSize', label: 'Note: Font size' }
    ];
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await openEditor(page, ['Inspector', 'Explorer']);
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Name field', exact: true })
        .click();
    const properties = page.getByRole('region', { name: 'Component properties', exact: true });
    await expect(
        properties.getByRole('heading', { name: 'Field label', exact: true })
    ).toBeVisible();
    await expect(properties.getByRole('heading', { name: 'Hint', exact: true })).toBeVisible();
    await expect(properties.getByRole('heading', { name: 'Note', exact: true })).toBeVisible();
});
