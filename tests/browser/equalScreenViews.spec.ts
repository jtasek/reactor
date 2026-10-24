import { expect, test } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

test('treats Mobile and Desktop as equal Screen views and preserves a screen with no placements', async ({
    page
}) => {
    const body = createShape({
        type: 'rectangle',
        name: 'Body',
        order: 'a0',
        parentFrameId: 'home',
        position: { x: 100, y: 120 },
        size: { width: 40, height: 30 }
    });
    const document = createDocument({
        id: 'equal-views-browser',
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                name: 'Home',
                position: { x: 80, y: 100 },
                size: { width: 390, height: 240 },
                visible: true,
                locked: false
            },
            desktop: {
                id: 'desktop',
                kind: 'view',
                screenId: 'home',
                name: 'Desktop',
                position: { x: 520, y: 100 },
                size: { width: 400, height: 240 },
                visible: true,
                locked: false
            }
        },
        shapes: { [body.id]: body }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Explorer', 'Inspector']);
    await page.getByRole('button', { name: 'More panels' }).click();
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Home · 390 px', exact: true }).click();
    await page.getByLabel('View name').fill('Mobile');
    await page.getByLabel('View name').press('Enter');
    await expect(
        explorer.getByRole('button', { name: 'Home · Mobile', exact: true })
    ).toHaveAccessibleDescription('Home · 390 × 240 Screen view');
    await expect(
        explorer.getByRole('button', { name: 'Home · Desktop', exact: true })
    ).toHaveAccessibleDescription('Home · 400 × 240 Screen view');
    const mobile = page.locator(
        'svg#surface #screen-views > [data-screen-view="home:view"] rect[data-cy="Body"]'
    );
    const desktop = page.locator(
        'svg#surface #screen-views > [data-screen-view="desktop"] rect[data-cy="Body"]'
    );
    await expect(page.locator('svg#surface #frames > [data-frame="home"]')).toHaveCount(0);
    await expect(mobile).toHaveAttribute('x', '100');
    await expect(desktop).toHaveAttribute('x', '540');
    await page.getByLabel('View x').fill('180');
    await page.getByLabel('View x').press('Enter');
    await page.getByLabel('View width').fill('430');
    await page.getByLabel('View width').press('Enter');
    await expect(mobile).toHaveAttribute('x', '200');
    await expect(desktop).toHaveAttribute('x', '540');
    await page.getByRole('button', { name: 'Delete Screen view', exact: true }).click();
    await expect(mobile).toHaveCount(0);
    await expect(desktop).toBeVisible();
    await explorer.getByRole('button', { name: 'Home · Desktop', exact: true }).click();
    await page.getByRole('button', { name: 'Delete Screen view', exact: true }).click();
    await expect(desktop).toHaveCount(0);
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(page.locator('svg#surface #screen-views [data-shape-id]')).toHaveCount(0);
    await expect(explorer.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
    await explorer.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Create Screen view', exact: true }).click();
    await expect(page.getByLabel('Screen view properties')).toBeVisible();
    await page.getByLabel('View name').fill('Mobile');
    await page.getByLabel('View name').press('Enter');
    await expect(page.locator('svg#surface #screen-views rect[data-cy="Body"]')).toBeVisible();
    await expect(
        explorer.getByRole('button', { name: 'Home · Mobile', exact: true })
    ).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-equal-screen-views.png' });
});
