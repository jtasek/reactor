import { expect, test } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { previewFixture } from '../support/preview';
import { openEditor } from './support/editor';
import { buildVariable, writeText } from 'src/app/variables';
import { createShape } from 'src/app/factories';

test('renders templates in native input values, placeholders and accessible labels', async ({
    page
}) => {
    const document = previewFixture();
    document.variables.person = buildVariable('person', 'Person', 'text', 'Ada')!;
    const field = document.shapes.field;
    const caption = document.shapes.caption;
    if (field.type !== 'text' || caption.type !== 'text') {
        throw new Error('Invalid preview fixture');
    }
    writeText(field, 'Hello ${Person}', document.variables);
    writeText(caption, 'Continue ${Person}', document.variables);
    document.components.input.interaction!.props = {
        label: 'label',
        value: 'label',
        placeholder: 'label'
    };
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (saved) => localStorage.setItem('reactor', saved),
        JSON.stringify(saved)
    );
    await openEditor(page);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const iframe = page.frameLocator('iframe[title="Application preview"]');
    const input = iframe.getByRole('textbox', { name: 'Hello Ada', exact: true });
    await expect(input).toHaveValue('Hello Ada');
    await expect(input).toHaveAttribute('placeholder', 'Hello Ada');
    await iframe.getByRole('button', { name: 'Continue Ada', exact: true }).click();
    await expect(iframe.getByLabel('Preview screen')).toHaveValue('details');
});

test('previews native inputs and navigation in an opaque sandbox, retains valid output after graph errors and resets local state', async ({
    page
}) => {
    const document = previewFixture();
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (saved) => localStorage.setItem('reactor', saved),
        JSON.stringify(saved)
    );
    const violations: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
            violations.push(message.text());
        }
    });
    await openEditor(page, ['Inspector', 'Explorer']);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const iframe = page.frameLocator('iframe[title="Application preview"]');
    await expect(iframe.getByLabel('Your name')).toBeVisible();
    await iframe.getByLabel('Your name').fill('Ada');
    const child = page.frames().find((frame) => frame.url().startsWith('http://127.0.0.1:4194'))!;
    expect(
        await child.evaluate(() => {
            try {
                return window.parent.document.title;
            } catch {
                return 'blocked';
            }
        })
    ).toBe('blocked');
    expect(
        await child.evaluate(() => {
            try {
                return localStorage.length;
            } catch {
                return 'blocked';
            }
        })
    ).toBe('blocked');
    await iframe.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(iframe.getByLabel('Preview screen')).toHaveValue('details');
    await iframe.getByLabel('Preview screen').selectOption('home');
    await expect(iframe.getByLabel('Your name')).toHaveValue('Ada');
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Button', exact: true }).click();
    await page.getByLabel('Role label', { exact: true }).selectOption('');
    await expect(page.getByText('Showing the last valid preview.')).toBeVisible();
    await expect(iframe.getByLabel('Your name')).toHaveValue('Ada');
    await page.getByLabel('Role label', { exact: true }).selectOption('label');
    await expect(page.getByText('Showing the last valid preview.')).toHaveCount(0);
    await expect(iframe.getByLabel('Your name')).toHaveValue('Ada');
    await iframe.getByRole('button', { name: 'Reset preview' }).click();
    await expect(iframe.getByLabel('Your name')).toHaveValue('');
    await page.getByRole('button', { name: 'Inspector', exact: true }).click();
    await page.getByRole('button', { name: 'More panels', exact: true }).click();
    await page.screenshot({ path: '/tmp/reactor-preview-normal.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(iframe.getByLabel('Your name')).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-preview-narrow.png' });
    expect(violations).toEqual([]);
});

test('explains unavailable hosting while keeping the editor usable', async ({ page }) => {
    await page.route('**/api/preview-config', (route) => route.fulfill({ json: { origin: null } }));
    await openEditor(page);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByText('Preview is not configured.', { exact: false })).toBeVisible();
    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
});

test('serves only static runtime files with a restricted policy', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:4194/');
    expect(response.headers()['content-security-policy']).toContain("connect-src 'none'");
    expect(response.headers()['content-security-policy']).toContain(
        'frame-ancestors http://127.0.0.1:4173'
    );
    expect(response.headers()['set-cookie']).toBeUndefined();
    expect((await request.get('http://127.0.0.1:4194/api/auth/get-session')).status()).toBe(404);
});

test('clips screens to their frame and keeps previewing a button whose screen is hidden', async ({
    page
}) => {
    const document = previewFixture();
    // Artwork sticking out above the frame must not cover the preview controls.
    document.shapes.banner = {
        ...createShape({
            type: 'rectangle',
            name: 'Banner',
            order: 'a9',
            position: { x: -50, y: -120 },
            size: { width: 500, height: 130 },
            parentFrameId: 'home',
            fill: '#ff0000'
        }),
        id: 'banner',
        selected: false
    };
    document.shapesIds.push('banner');
    document.frames.details.visible = false;
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (saved) => localStorage.setItem('reactor', saved),
        JSON.stringify(saved)
    );
    await openEditor(page);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const iframe = page.frameLocator('iframe[title="Application preview"]');
    await expect(
        page.getByText('Continue button links to an unavailable screen', { exact: false })
    ).toBeVisible();
    await iframe.getByLabel('Your name').fill('Ada');
    await iframe.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(iframe.getByLabel('Preview screen')).toHaveValue('home');
    await iframe.getByRole('button', { name: 'Reset preview' }).click({ timeout: 5000 });
    await expect(iframe.getByLabel('Your name')).toHaveValue('');
});

test('updates the preview when a drag ends, not on every pointer move', async ({ page }) => {
    const document = previewFixture();
    document.frames.wide = {
        id: 'wide',
        kind: 'screen',
        name: 'Wide',
        position: { x: 800, y: 100 },
        size: { width: 200, height: 200 },
        visible: true,
        locked: false
    };
    document.shapes.box = {
        ...createShape({
            type: 'rectangle',
            name: 'Box',
            order: 'a9',
            position: { x: 840, y: 150 },
            size: { width: 80, height: 60 },
            parentFrameId: 'wide',
            fill: '#00ff00'
        }),
        id: 'box',
        selected: false
    };
    document.shapesIds.push('box');
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (saved) => localStorage.setItem('reactor', saved),
        JSON.stringify(saved)
    );
    await openEditor(page);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const iframe = page.frameLocator('iframe[title="Application preview"]');
    await iframe.getByLabel('Preview screen').selectOption('wide');
    const box = iframe.locator('rect[fill="#00ff00"]');
    await expect(box).toHaveAttribute('x', '840');
    const surface = (await page.locator('svg#surface').boundingBox())!;
    await page.mouse.click(surface.x + 880, surface.y + 180);
    await page.mouse.down();
    await page.mouse.move(surface.x + 860, surface.y + 230, { steps: 6 });
    await expect(page.locator('svg#surface rect[x="820"]').first()).toBeAttached();
    await expect(box).toHaveAttribute('x', '840');
    await page.mouse.up();
    await expect(box).toHaveAttribute('x', '820');
});
