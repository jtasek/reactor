import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import type { Asset } from 'src/app/services/documentDatabase';
import { createShape } from 'src/app/factories';
import { previewImageAsset, previewImageFixture } from '../support/previewImages';
import { openEditor } from './support/editor';

async function keepImage(page: Page, image: Asset) {
    await page.evaluate(
        async ({ hash, type, bytes }) => {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open('reactor', 2);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction('assets', 'readwrite');
                transaction.objectStore('assets').put({ hash, type, bytes: new Uint8Array(bytes) });
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
            db.close();
        },
        { hash: image.hash, type: image.type, bytes: Array.from(image.bytes) }
    );
}

async function openImageDocument(page: Page, hash: string) {
    const document = previewImageFixture(hash);
    document.shapes.outline = {
        ...createShape({
            type: 'rectangle',
            name: 'Outline',
            order: 'a7',
            position: { x: 24, y: 320 },
            size: { width: 100, height: 40 },
            parentFrameId: 'home'
        }),
        id: 'outline',
        selected: false
    };
    document.shapesIds.push('outline');
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (saved) => localStorage.setItem('reactor', saved),
        JSON.stringify(saved)
    );
    await openEditor(page);
}

test('shows real stored images with canvas geometry and no editor requests from the sandbox', async ({
    page
}) => {
    const asset = await previewImageAsset();
    await openImageDocument(page, asset.hash);
    await keepImage(page, asset);
    await openEditor(page);
    const requests: string[] = [];
    page.on('request', (request) => {
        if (
            request.frame().url().startsWith('http://127.0.0.1:4194') &&
            request.url().startsWith('http://127.0.0.1:4173')
        ) {
            requests.push(request.url());
        }
    });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const iframe = page.frameLocator('iframe[title="Application preview"]');
    await expect(iframe.locator('svg image')).toHaveCount(2);
    const images = iframe.locator('svg image');
    await expect(images.first()).toHaveAttribute('href', /^data:image\/png;base64,/);
    await expect(images.first()).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    const canvasImages = page.locator('svg#surface #shapes image');
    for (let index = 0; index < 2; index += 1) {
        for (const attribute of ['x', 'y', 'width', 'height', 'preserveAspectRatio']) {
            await expect(images.nth(index)).toHaveAttribute(
                attribute,
                (await canvasImages.nth(index).getAttribute(attribute))!
            );
        }
    }
    await expect(images.nth(1).locator('..')).toHaveAttribute('opacity', '0.5');
    await expect(images.nth(1).locator('..')).toHaveAttribute('transform', /^rotate\(15 /);
    const canvasOutline = page.locator('svg#surface #shapes rect[data-cy="Outline"]');
    const previewOutline = iframe.locator('svg rect[x="24"][y="320"]');
    const outlineStyle = (node: Element) => {
        const style = getComputedStyle(node);

        return { fill: style.fill, stroke: style.stroke, strokeWidth: style.strokeWidth };
    };
    expect(await previewOutline.evaluate(outlineStyle)).toEqual(
        await canvasOutline.evaluate(outlineStyle)
    );
    const textStyle = (node: Element) => {
        const style = getComputedStyle(node);

        return { fill: style.fill, fontFamily: style.fontFamily, fontSize: style.fontSize };
    };
    expect(
        await iframe.locator('svg text').filter({ hasText: 'Continue' }).evaluate(textStyle)
    ).toEqual(
        await page.locator('svg#surface #shapes text[data-cy="Caption"]').evaluate(textStyle)
    );
    await images.first().evaluate(async (node) => {
        const image = new Image();
        image.src = node.getAttribute('href')!;
        await image.decode();
        if (image.naturalWidth !== 1 || image.naturalHeight !== 1) {
            throw new Error('Image did not decode at its intrinsic aspect ratio');
        }
    });
    await iframe.getByLabel('Your name').fill('Ada');
    await iframe.getByRole('button', { name: 'Continue', exact: true }).click();
    await iframe.getByLabel('Preview screen').selectOption('home');
    await expect(iframe.getByLabel('Your name')).toHaveValue('Ada');
    await page.screenshot({ path: '/tmp/reactor-preview-images-normal.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(images.first()).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-preview-images-narrow.png' });
    expect(requests).toEqual([]);
});

test('retries an image that arrives after the preview opens', async ({ page }) => {
    const asset = await previewImageAsset();
    await openImageDocument(page, asset.hash);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByText('An image is not available yet.', { exact: false })).toBeVisible();
    const iframe = page.frameLocator('iframe[title="Application preview"]');
    await expect(iframe.locator('svg')).toHaveCount(0);
    await keepImage(page, asset);
    await page.getByRole('button', { name: 'Retry preview', exact: true }).click();
    await expect(iframe.locator('svg image')).toHaveCount(2);
    await expect(page.getByText('An image is not available yet.', { exact: false })).toHaveCount(0);
    await expect(page.getByText('Preparing preview images…')).toHaveCount(0);
});

test('rejects a raster with a valid signature and hash that cannot be decoded', async ({
    page
}) => {
    const asset = await previewImageAsset();
    const bytes = asset.bytes.slice(0, 8);
    const invalid = {
        hash: createHash('sha256').update(bytes).digest('hex'),
        bytes,
        type: 'image/png'
    };
    await openImageDocument(page, invalid.hash);
    await keepImage(page, invalid);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByText('An image could not be decoded.', { exact: false })).toBeVisible();
    await expect(
        page.frameLocator('iframe[title="Application preview"]').locator('svg')
    ).toHaveCount(0);
    await expect(page.locator('svg#surface')).toBeVisible();
});

test('keeps the last valid preview when an image is lost, then recovers on retry', async ({
    page
}) => {
    const asset = await previewImageAsset();
    await openImageDocument(page, asset.hash);
    await keepImage(page, asset);
    await openEditor(page, ['Explorer']);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const iframe = page.frameLocator('iframe[title="Application preview"]');
    await expect(iframe.locator('svg image')).toHaveCount(2);
    const explorer = page.getByRole('region', { name: 'Explorer', exact: true });
    const home = explorer.getByRole('button', { name: 'Home', exact: true });
    const menu = explorer.getByRole('toolbar', { name: 'Home menu', exact: true });
    await home.hover();
    await menu.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(iframe.getByLabel('Preview screen')).toHaveValue('details');
    await page.evaluate(async (hash) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('reactor', 2);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction('assets', 'readwrite');
            transaction.objectStore('assets').delete(hash);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        db.close();
    }, asset.hash);
    await home.hover();
    await menu.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(page.getByText('Showing the last valid preview.')).toBeVisible();
    await expect(page.getByText('An image is not available yet.', { exact: false })).toBeVisible();
    await expect(iframe.locator('svg')).toContainText('Hello from details');
    await expect(iframe.locator('svg image')).toHaveCount(0);
    await keepImage(page, asset);
    await page.getByRole('button', { name: 'Retry preview', exact: true }).click();
    await expect(page.getByText('Showing the last valid preview.')).toHaveCount(0);
    await iframe.getByLabel('Preview screen').selectOption('home');
    await expect(iframe.locator('svg image')).toHaveCount(2);
});

test('explains an outdated runtime instead of sending image references it cannot render', async ({
    page
}) => {
    const asset = await previewImageAsset();
    await openImageDocument(page, asset.hash);
    await keepImage(page, asset);
    await page.route('http://127.0.0.1:4194/', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: `<html><body><script>
            window.addEventListener('message', (event) => {
                const port = event.ports[0];
                port.onmessage = () => { document.body.textContent = 'Unexpected projection'; };
                port.postMessage({type: 'ready'});
            });
        </script></body></html>`
        })
    );
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(
        page.getByText('The preview server is out of date.', { exact: false })
    ).toBeVisible();
    await expect(
        page.frameLocator('iframe[title="Application preview"]').getByText('Unexpected projection')
    ).toHaveCount(0);
    await expect(page.locator('svg#surface')).toBeVisible();
});

test('sends each image to the preview once, not with every update', async ({ page }) => {
    const asset = await previewImageAsset();
    await page.addInitScript(() => {
        const sent: number[] = [];
        (window as unknown as { previewImageCounts: number[] }).previewImageCounts = sent;
        const post = MessagePort.prototype.postMessage;
        MessagePort.prototype.postMessage = function (
            this: MessagePort,
            ...args: Parameters<MessagePort['postMessage']>
        ) {
            const data = args[0] as { screens?: unknown; images?: object } | undefined;
            if (window === window.top && data?.screens) {
                sent.push(Object.keys(data.images ?? {}).length);
            }

            return post.apply(this, args);
        } as MessagePort['postMessage'];
    });
    await openImageDocument(page, asset.hash);
    await keepImage(page, asset);
    await openEditor(page, ['Explorer']);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const iframe = page.frameLocator('iframe[title="Application preview"]');
    await expect(iframe.locator('svg image')).toHaveCount(2);
    const counts = () =>
        page.evaluate(
            () => (window as unknown as { previewImageCounts: number[] }).previewImageCounts
        );
    // Both image shapes share one file, sent once.
    expect(await counts()).toEqual([1]);
    const explorer = page.getByRole('region', { name: 'Explorer', exact: true });
    const details = explorer.getByRole('button', { name: 'Details', exact: true });
    const menu = explorer.getByRole('toolbar', { name: 'Details menu', exact: true });
    await details.hover();
    await menu.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect.poll(counts).toEqual([1, 0]);
    await details.hover();
    await menu.getByRole('button', { name: 'Show', exact: true }).click();
    await expect.poll(counts).toEqual([1, 0, 0]);
    await expect(iframe.locator('svg image')).toHaveCount(2);
    await expect(page.getByText('Preview needs attention')).toHaveCount(0);
});
