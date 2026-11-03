import { expect, test } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { expectPlacedCoordinate, openEditor } from './support/editor';

test('a view command edits its shared stack and undoes both inputs together', async ({ page }) => {
    const base = {
        visible: true,
        locked: false,
        position: { x: 100, y: 80 },
        size: { width: 300, height: 200 }
    };
    const document = createDocument({
        id: 'command-stack',
        frames: {
            home: {
                ...base,
                id: 'home',
                name: 'Home',
                kind: 'screen',
                definitionOnly: true,
                stack: { direction: 'row', gap: 8, padding: 12, align: 'start' }
            },
            desktop: {
                ...base,
                id: 'desktop',
                name: 'Desktop',
                kind: 'view',
                screenId: 'home',
                position: { x: 500, y: 300 }
            }
        },
        shapes: Object.fromEntries(
            ['First', 'Second'].map((name, order) => [
                name,
                {
                    ...createShape({
                        order: `a${order}`,
                        name,
                        type: 'rectangle',
                        parentFrameId: 'home',
                        position: { x: 120, y: 100 },
                        size: { width: 40, height: 20 }
                    }),
                    id: name,
                    selected: false
                }
            ])
        ),
        shapesIds: ['First', 'Second']
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Explorer', 'Command Line']);
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Home · Desktop', exact: true })
        .click();
    const input = page.getByRole('combobox', { name: 'Command' });
    await expect(page.locator('form', { has: input })).toContainText('active shared layout');
    await input.fill('Edit stack spacing');
    await input.press('ArrowDown');
    await input.press('Enter');
    await page.getByRole('textbox', { name: 'Gap', exact: true }).fill('20');
    await page.getByRole('textbox', { name: 'Padding', exact: true }).fill('16');
    await page.getByRole('button', { name: 'Apply changes', exact: false }).click();
    const first = page.locator('[data-screen-view="desktop"] rect[data-cy="First"]');
    const second = page.locator('[data-screen-view="desktop"] rect[data-cy="Second"]');
    await expectPlacedCoordinate(first, 'x', '516');
    await expectPlacedCoordinate(first, 'y', '316');
    await expectPlacedCoordinate(second, 'x', '576');
    await input.fill('undo');
    await input.press('Enter');
    await expectPlacedCoordinate(first, 'x', '512');
    await expectPlacedCoordinate(second, 'x', '560');
    await input.fill('redo');
    await input.press('Enter');
    await expectPlacedCoordinate(second, 'x', '576');
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await expectPlacedCoordinate(second, 'x', '576');
});

test('stack spacing is unavailable without a stack, and Ctrl/Cmd+K reopens the palette', async ({
    page
}) => {
    const document = createDocument({
        id: 'command-no-stack',
        frames: {
            home: {
                id: 'home',
                name: 'Home',
                kind: 'frame',
                visible: true,
                locked: false,
                position: { x: 100, y: 80 },
                size: { width: 300, height: 200 }
            }
        }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Explorer', 'Command Line']);
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Home', exact: true })
        .click();
    const input = page.getByRole('combobox', { name: 'Command' });
    const form = page.locator('form', { has: input });
    await input.fill('Edit stack spacing');
    const option = page.getByRole('option', { name: /Edit stack spacing/ });
    await expect(option).toHaveAttribute('aria-disabled', 'true');
    await expect(option).toContainText('This frame has no stack');
    await input.press('Enter');
    await expect(form.getByRole('status')).toHaveText(
        'This frame has no stack. Choose Row or Column in the Inspector first.'
    );
    await expect(form.getByRole('textbox', { name: 'Gap', exact: true })).toHaveCount(0);

    await input.fill('Resize selection');
    await input.press('Enter');
    await expect(form.getByRole('textbox', { name: 'Width', exact: true })).toBeVisible();
    await expect(form.getByText(/^Edit frame:/)).toHaveCount(0);

    await input.press('Escape');
    await input.press('Escape');
    await expect(input).toHaveCount(0);
    await page.locator('svg#surface').click({ position: { x: 700, y: 600 } });
    await page.keyboard.press('ControlOrMeta+k');
    await expect(input).toBeFocused();
});
