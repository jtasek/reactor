import { expect, test } from '@playwright/test';
import { createDocument } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { expectPlacedCoordinate, openEditor } from './support/editor';

for (const kind of ['frame', 'view'] as const) {
    test(`command creation belongs to the selected ${kind}, survives reload and undoes`, async ({
        page
    }) => {
        const base = {
            visible: true,
            locked: false,
            position: { x: 100, y: 80 },
            size: { width: 300, height: 200 }
        };
        const document = createDocument({
            id: 'command-frames',
            frames: {
                home: {
                    ...base,
                    id: 'home',
                    name: 'Home',
                    kind: kind === 'frame' ? 'frame' : 'screen',
                    ...(kind === 'view' ? { definitionOnly: true } : {})
                },
                ...(kind === 'view'
                    ? {
                          desktop: {
                              ...base,
                              id: 'desktop',
                              name: 'Desktop',
                              kind: 'view' as const,
                              screenId: 'home',
                              position: { x: 500, y: 300 },
                              size: { width: 500, height: 250 }
                          }
                      }
                    : {})
            }
        });
        const saved = serializePersistedState({
            currentDocumentId: document.id,
            documents: { [document.id]: document }
        });
        await page.addInitScript(
            (raw) => localStorage.setItem('reactor', raw),
            JSON.stringify(saved)
        );
        await openEditor(page, ['Explorer', 'Command Line', 'Inspector']);
        const name = kind === 'frame' ? 'Home' : 'Home · Desktop';
        await page
            .getByRole('region', { name: 'Explorer' })
            .getByRole('button', { name, exact: true })
            .click();
        const input = page.getByRole('combobox', { name: 'Command' });
        const prefix = kind === 'view' ? 'View' : 'Frame';
        await input.fill('w=390 h=844');
        await input.press('Enter');
        await expect(
            page.getByRole('spinbutton', { name: `${prefix} width`, exact: true })
        ).toHaveValue('390');
        await expect(
            page.getByRole('spinbutton', { name: `${prefix} height`, exact: true })
        ).toHaveValue('844');
        await input.fill('undo');
        await input.press('Enter');
        await expect(
            page.getByRole('spinbutton', { name: `${prefix} width`, exact: true })
        ).toHaveValue(kind === 'view' ? '500' : '300');
        await input.fill('move x=24 y=-8');
        await input.press('Enter');
        await expect(
            page.getByRole('spinbutton', { name: `${prefix} x`, exact: true })
        ).toHaveValue(kind === 'view' ? '524' : '124');
        await input.fill('undo');
        await input.press('Enter');
        await input.fill('rectangle w=40 h=20 x=12 y=30 name="Created here"');
        await input.press('Enter');
        const shape = page.locator(
            kind === 'view'
                ? 'svg#surface [data-screen-view="desktop"] rect[data-cy="Created here"]'
                : 'svg#surface rect[data-cy="Created here"]'
        );
        await expect(shape).toHaveCount(1);
        await expectPlacedCoordinate(shape, 'x', kind === 'frame' ? '112' : '512');
        await expectPlacedCoordinate(shape, 'y', kind === 'frame' ? '110' : '330');
        await input.fill('undo');
        await input.press('Enter');
        await expect(shape).toHaveCount(0);
        await input.fill('redo');
        await input.press('Enter');
        await expect(shape).toHaveCount(1);
        await page
            .getByRole('region', { name: 'Explorer' })
            .getByRole('button', { name: 'Created here', exact: true })
            .click();
        await input.fill('w=120 h=60 r=12');
        await input.press('Enter');
        await expect(shape).toHaveAttribute('width', '120');
        await expect(shape).toHaveAttribute('height', '60');
        await expect(shape).toHaveAttribute('rx', '12');
        await input.fill('undo');
        await input.press('Enter');
        await expect(shape).toHaveAttribute('width', '40');
        await expect(shape).toHaveAttribute('height', '20');
        await input.fill('move x=16 y=-8');
        await input.press('Enter');
        await expectPlacedCoordinate(shape, 'x', kind === 'frame' ? '128' : '528');
        await expectPlacedCoordinate(shape, 'y', kind === 'frame' ? '102' : '322');
        await input.fill('undo');
        await input.press('Enter');
        await expect(page.locator('#status-save')).toHaveText('Saved');
        await page.reload();
        await expect(shape).toHaveCount(1);
        await expectPlacedCoordinate(shape, 'x', kind === 'frame' ? '112' : '512');
    });
}

for (const lock of ['frame', 'document'] as const) {
    test(`command creation explains a locked ${lock}`, async ({ page }) => {
        const document = createDocument({
            id: 'command-locked',
            ...(lock === 'document' ? { locked: true } : {}),
            frames: {
                home: {
                    id: 'home',
                    name: 'Home',
                    kind: 'frame',
                    visible: true,
                    locked: lock === 'frame',
                    position: { x: 100, y: 80 },
                    size: { width: 300, height: 200 }
                }
            }
        });
        const saved = serializePersistedState({
            currentDocumentId: document.id,
            documents: { [document.id]: document }
        });
        await page.addInitScript(
            (raw) => localStorage.setItem('reactor', raw),
            JSON.stringify(saved)
        );
        await openEditor(page, ['Explorer', 'Command Line']);
        await page
            .getByRole('region', { name: 'Explorer' })
            .getByRole('button', { name: 'Home', exact: true })
            .click();
        const input = page.getByRole('combobox', { name: 'Command' });
        const form = page.locator('form', { has: input });
        await expect(form).toContainText('Selection is locked or hidden');
        await input.fill('rectangle');
        await input.press('Enter');
        await expect(form.getByRole('status')).toHaveText(
            lock === 'document'
                ? /^Creation is unavailable/
                : /^The selected frame is unavailable, hidden or locked/
        );
        await expect(page.locator('svg#surface rect[data-cy="Rectangle 1"]')).toHaveCount(0);
    });
}
