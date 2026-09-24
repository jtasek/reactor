import { expect, test, type Page } from '@playwright/test';
import type { PersistedState } from 'src/app/services/documentStorage';
import { drawRect, openEditor, shapes } from './support/editor';

const savedData = (page: Page) => page.evaluate(() => localStorage.getItem('reactor') ?? '');

test('migrates a legacy text shape, renders its content, and preserves the original', async ({
    page
}) => {
    const metadata = {
        created: '2026-01-01T00:00:00.000Z',
        modified: '2026-01-01T00:00:00.000Z',
        createdBy: 'anonymous',
        modifiedBy: 'anonymous',
        locked: false
    };
    const snapshot: PersistedState = {
        version: 1,
        currentDocumentId: 'document-1',
        documents: {
            'document-1': {
                ...metadata,
                id: 'restored-document',
                author: 'anonymous',
                name: 'Saved drawing',
                tags: [],
                camera: { scale: 1, position: { x: 0, y: 0 } },
                grid: { width: 10, height: 10, factor: 10, visible: true },
                shapes: {
                    label: {
                        ...metadata,
                        id: 'label',
                        name: 'Saved label',
                        type: 'text',
                        position: { x: 100, y: 100 },
                        visible: true,
                        value: 'Restored text',
                        fontSize: 24
                    }
                },
                groups: {},
                layers: {},
                components: {},
                links: {},
                rulers: {}
            }
        }
    };
    const original = JSON.stringify(snapshot);
    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(error.message));

    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), original);
    await page.goto('/');

    await expect(page.locator('svg#surface text[data-cy="Saved label"]')).toHaveText(
        'Restored text'
    );
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.reload();

    await expect(page.locator('svg#surface text[data-cy="Saved label"]')).toHaveText(
        'Restored text'
    );

    const stored = await page.evaluate(() => Object.entries(localStorage));

    expect(stored.find(([key]) => key === 'reactor')?.[1]).toBe(original);
    expect(
        stored.filter(([key]) => key.startsWith('reactor:backup:')).map(([, raw]) => raw)
    ).toEqual([original]);
    expect(errors).toEqual([]);
});

test('shows a recovery notice without replacing malformed saved data', async ({ page }) => {
    const original = '{unreadable';

    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), original);
    await page.goto('/');

    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('original is preserved');

    expect(await page.evaluate(() => localStorage.getItem('reactor'))).toBe(original);
});

test('saves drawn shapes, so they survive a reload', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await expect.poll(() => savedData(page)).toContain('"rectangle"');

    await page.reload();

    await expect(shapes(page)).toHaveCount(1);
});

test('tabs load each other’s saves, so neither overwrites the other', async ({ page }) => {
    const otherTab = await page.context().newPage();

    await openEditor(page);
    await openEditor(otherTab);

    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await expect(shapes(otherTab)).toHaveCount(1);

    await drawRect(otherTab, { x: 300, y: 100 }, { x: 350, y: 150 });
    await expect(shapes(page)).toHaveCount(2);

    await page.reload();

    await expect(shapes(page)).toHaveCount(2);
});
