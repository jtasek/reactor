import { expect, test, type Page } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

async function seed(page: Page) {
    const shape = createShape({
        type: 'text',
        name: 'Sample',
        order: 'a0',
        position: { x: 80, y: 180 },
        value: '12345 Wide text',
        fontSize: 12,
        selected: false
    });
    const document = createDocument({
        id: 'typography',
        name: 'Typography',
        shapes: { [shape.id]: shape }
    });
    await page.addInitScript(
        (raw) => localStorage.setItem('reactor', raw),
        JSON.stringify(
            serializePersistedState({
                currentDocumentId: document.id,
                documents: { [document.id]: document }
            })
        )
    );
}

test.describe('touch typography', () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

    test('interface fields stay readable without resizing authored canvas text', async ({
        page
    }) => {
        await seed(page);
        await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
        await page.route('**/api/sign-in/providers', (route) => route.fulfill({ json: [] }));
        await page.goto('/login');
        await expect(page.getByLabel('Email', { exact: true })).toHaveCSS('font-size', '16px');
        await expect(page.getByLabel('Password', { exact: true })).toHaveCSS('font-size', '16px');
        await page.screenshot({ path: 'test-results/typography-login-touch.png' });

        await page.goto('/variables');
        await expect(page.getByLabel('Search variables')).toHaveCSS('font-size', '16px');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true
        );
        await page.screenshot({ path: 'test-results/typography-variables-touch.png' });

        await openEditor(page, ['Command Line']);
        await expect(page.getByRole('combobox', { name: 'Command', exact: true })).toHaveCSS(
            'font-size',
            '16px'
        );
        await page.screenshot({ path: 'test-results/typography-command-touch.png' });
        await page.getByRole('combobox', { name: 'Command', exact: true }).press('Escape');
        const text = page.locator('#shapes text[data-cy="Sample"]');
        await expect(text).toHaveCSS('font-size', '12px');
        await page.getByRole('button', { name: 'More panels' }).click();
        await text.dblclick();
        await expect(page.getByRole('textbox', { name: 'Text', exact: true })).toHaveCSS(
            'font-size',
            '12px'
        );
    });
});

test('shared artwork renderer preserves canvas font and text width', async ({ page }) => {
    await seed(page);
    await openEditor(page);
    const canvasText = page.locator('#shapes text[data-cy="Sample"]');
    const original = await canvasText.evaluate((node) => ({
        family: getComputedStyle(node).fontFamily,
        width: (node as SVGTextElement).getComputedTextLength()
    }));
    await page.goto('/documents');
    const thumbnail = page.getByRole('img', { name: 'Preview of Typography', exact: true });
    const text = thumbnail.locator('text');
    await expect(text).toHaveCSS('font-family', original.family);
    expect(
        await text.evaluate((node) => (node as SVGTextElement).getComputedTextLength())
    ).toBeCloseTo(original.width, 1);
    await page.screenshot({ path: 'test-results/typography-documents.png' });
});
