import { expect, test } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor, shapes } from './support/editor';

test('Tab completes a property without executing and Enter still applies explicit edits', async ({
    page
}) => {
    await openEditor(page, ['Command Line', 'Explorer']);
    const input = page.getByRole('combobox', { name: 'Command' });
    await input.fill('rectangle w=80 h=40 name="Card"');
    await input.press('Enter');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Card', exact: true })
        .click();
    const card = shapes(page).locator('rect[data-cy="Card"]');
    await input.fill('wi');
    await expect(page.getByRole('listbox', { name: 'Parameter suggestions' })).toBeVisible();
    await input.press('Tab');
    await expect(input).toHaveValue('width=');
    await expect(card).toHaveAttribute('width', '80');
    await input.fill('width=120');
    await input.press('Enter');
    await expect(card).toHaveAttribute('width', '120');
    await input.fill('fill=#3366ff ');
    await input.press('Enter');
    await expect(card).toHaveCSS('fill', 'rgb(51, 102, 255)');
});

test('completion respects the cursor and Escape dismisses suggestions without losing text', async ({
    page
}) => {
    await openEditor(page, ['Command Line']);
    const input = page.getByRole('combobox', { name: 'Command' });
    await input.fill('rectangle wi');
    await expect(page.getByRole('listbox', { name: 'Parameter suggestions' })).toBeVisible();
    await input.press('Escape');
    await expect(input).toHaveValue('rectangle wi');
    await expect(page.getByRole('listbox', { name: 'Parameter suggestions' })).toHaveCount(0);
    await input.fill('rectangle wi');
    await input.press('Home');
    await expect(page.getByRole('listbox', { name: 'Parameter suggestions' })).toHaveCount(0);
});

test('variable completion inserts a compatible ID without applying until Enter', async ({
    page
}, testInfo) => {
    const document = createDocument({
        id: 'completion',
        variables: {
            brand: {
                id: 'brand',
                name: 'Brand Primary',
                type: 'color',
                values: { default: '#3366ff' }
            },
            size: { id: 'size', name: 'Brand Size', type: 'number', values: { default: 24 } }
        },
        shapes: {
            card: {
                ...createShape({
                    type: 'rectangle',
                    name: 'Card',
                    order: 'a0',
                    position: { x: 20, y: 20 },
                    size: { width: 80, height: 40 },
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
    const card = shapes(page).locator('rect[data-cy="Card"]');
    await input.fill('bind property=fill variable="Brand');
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option')).toContainText('Brand Primary');
    await page.screenshot({ path: testInfo.outputPath('completion.png') });
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.getByRole('option')).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('completion-narrow.png') });
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(input).toHaveValue('bind property=fill variable="brand"');
    await expect(card).toHaveCSS('fill', 'rgb(17, 34, 51)');
    await input.press('Enter');
    await expect(card).toHaveCSS('fill', 'rgb(51, 102, 255)');
    await input.fill('undo');
    await input.press('Enter');
    await expect(card).toHaveCSS('fill', 'rgb(17, 34, 51)');
});

test('Enter keeps command search available when a query also matches a property', async ({
    page
}) => {
    await openEditor(page, ['Command Line', 'Explorer']);
    const input = page.getByRole('combobox', { name: 'Command' });
    await input.fill('rectangle w=80 h=40 name="Card"');
    await input.press('Enter');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Card', exact: true })
        .click();
    await input.fill('fi');
    await expect(page.getByRole('listbox', { name: 'Parameter suggestions' })).toBeVisible();
    await input.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Fill', exact: true })).toBeFocused();
});
