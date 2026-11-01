import { createDocument, createShape } from 'src/app/factories';
import { previewImageAsset } from '../support/previewImages';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { prototypeDocument } from '../support/prototype';
import { openEditor } from './support/editor';

test('downloads a standalone SVG of the selected Screen view with its modes and no editor overlays', async ({
    page
}) => {
    const document = prototypeDocument();
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);
    await page.locator('#frames > [data-frame="view"]').press('Enter');
    const exported = page.waitForEvent('download');
    await page
        .getByRole('list', { name: 'Commands' })
        .getByRole('button', { name: 'Export SVG', exact: true })
        .click();
    const download = await exported;
    expect(download.suggestedFilename()).toBe('Home · Mobile.svg');
    const svg = await readFile((await download.path())!, 'utf8');
    expect(svg).toContain('viewBox="400 200 320 480"');
    expect(svg).toContain('#ddeeff');
    expect(svg).toContain('font-size="14"');
    expect(svg).not.toMatch(/foreignObject|data-shape|var\(|navigateTo/);
    const recipient = await page.context().newPage();
    await recipient.route('https://svg-export.test/art.svg', (route) =>
        route.fulfill({ body: svg, contentType: 'image/svg+xml' })
    );
    await recipient.goto('https://svg-export.test/art.svg');
    await expect(recipient.locator('parsererror')).toHaveCount(0);
    await expect(recipient.locator('svg')).toHaveAttribute('width', '320');
    await expect(recipient.locator('svg text').first()).toBeVisible();
    await recipient.screenshot({ path: 'test-results/screen-export.png' });
    await recipient.close();
});

test('embeds a selected raster image', async ({ page }) => {
    const asset = await previewImageAsset();
    const image = createShape({
        type: 'image',
        name: 'Picture',
        order: 'a0',
        source: `asset:${asset.hash}`,
        position: { x: 200, y: 200 },
        size: { width: 120, height: 60 }
    });
    const document = createDocument({ name: 'Images', shapes: { [image.id]: image } });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await openEditor(page);
    await page.evaluate(
        async ({ hash, bytes, type }) => {
            const request = indexedDB.open('reactor', 2);
            const db = await new Promise<IDBDatabase>((resolve) => {
                request.onsuccess = () => resolve(request.result);
            });
            const transaction = db.transaction('assets', 'readwrite');
            transaction.objectStore('assets').put({ hash, bytes: new Uint8Array(bytes), type });
            await new Promise<void>((resolve) => {
                transaction.oncomplete = () => resolve();
            });
            db.close();
        },
        { ...asset, bytes: Array.from(asset.bytes) }
    );
    await page.reload();
    await expect(page.locator('#shapes image')).toHaveAttribute('href', /^blob:/);
    await page.locator('#shapes image').click();
    const exported = page.waitForEvent('download');
    await page
        .getByRole('list', { name: 'Commands' })
        .getByRole('button', { name: 'Export SVG', exact: true })
        .click();
    const svg = await readFile((await (await exported).path())!, 'utf8');
    expect(svg).toContain('href="data:image/png;base64,');
    expect(svg).not.toMatch(/blob:|asset:/);
    expect(svg).toContain('width="128" height="68"');
});
