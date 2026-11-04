import { expect, test } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor, shapes } from './support/editor';

test('guided bindings, literal colors and text remain undoable', async ({ page }, testInfo) => {
    const document = createDocument({
        id: 'palette-properties',
        variables: {
            brand: {
                id: 'brand',
                name: 'brand/primary',
                type: 'color',
                values: { default: '#3366ff' }
            }
        },
        shapes: {
            card: {
                ...createShape({
                    type: 'rectangle',
                    name: 'Card',
                    order: 'a0',
                    position: { x: 20, y: 20 },
                    size: { width: 100, height: 40 },
                    fill: '#112233'
                }),
                id: 'card',
                selected: true
            }
        },
        shapesIds: ['card']
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Command Line', 'Explorer']);
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Card', exact: true })
        .click();
    const input = page.getByRole('combobox', { name: 'Command' });
    const run = async (value: string) => {
        await input.fill(value);
        await input.press('Enter');
    };
    await run('Bind variable');
    const property = page.getByRole('combobox', { name: 'Property', exact: true });
    await expect(property).toBeFocused();
    await property.selectOption('fill');
    await page.getByRole('combobox', { name: 'Variable', exact: true }).selectOption('brand');
    await page.screenshot({ path: testInfo.outputPath('binding.png') });
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(property).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('binding-narrow.png') });
    await page.getByRole('button', { name: 'Apply changes' }).click();
    const card = shapes(page).locator('rect[data-cy="Card"]');
    await expect(card).toHaveCSS('fill', 'rgb(51, 102, 255)');
    await run('fill=#abcdef');
    await expect(card).toHaveCSS('fill', 'rgb(171, 205, 239)');
    await run('undo');
    await expect(card).toHaveCSS('fill', 'rgb(51, 102, 255)');
    await page.setViewportSize({ width: 1280, height: 800 });
    await run('text value="Original" name="Label"');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Label', exact: true })
        .click();
    await run('text="Continue" fs=18 fc=#123456');
    await expect(shapes(page).locator('text')).toContainText(['Continue']);
    await run('undo');
    await expect(shapes(page).locator('text')).toContainText(['Original']);
});
