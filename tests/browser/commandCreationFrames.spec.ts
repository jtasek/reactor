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
        await openEditor(page, ['Explorer', 'Command Line']);
        const name = kind === 'frame' ? 'Home' : 'Home · Desktop';
        await page
            .getByRole('region', { name: 'Explorer' })
            .getByRole('button', { name, exact: true })
            .click();
        const input = page.getByRole('combobox', { name: 'Command' });
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
        await expect(page.locator('#status-save')).toHaveText('Saved');
        await page.reload();
        await expect(shape).toHaveCount(1);
        await expectPlacedCoordinate(shape, 'x', kind === 'frame' ? '112' : '512');
    });
}
