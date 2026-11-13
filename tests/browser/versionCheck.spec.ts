import { expect, test, type Page } from '@playwright/test';
import * as Y from 'yjs';
import { drawRect, openEditor, shapes } from './support/editor';

/** The ids of the documents this browser has saved. */
const savedDocumentIds = (page: Page) =>
    page.evaluate(
        () =>
            new Promise<string[]>((resolve, reject) => {
                const opening = indexedDB.open('reactor');

                opening.onerror = () => reject(opening.error);
                opening.onsuccess = () => {
                    const keys = opening.result
                        .transaction('documents')
                        .objectStore('documents')
                        .getAllKeys();

                    keys.onsuccess = () => {
                        opening.result.close();
                        resolve(keys.result.map(String));
                    };
                };
            })
    );

/** A newer editor's change to every saved document, shared from another tab. */
async function editInNewerTab(page: Page, editableFrom: number) {
    await expect.poll(() => savedDocumentIds(page)).not.toEqual([]);

    const doc = new Y.Doc();

    doc.getMap('versions').set(`${editableFrom}`, true);

    // A page of the same origin without the editor, so only `page` receives the change.
    const otherTab = await page.context().newPage();

    await otherTab.goto('/healthz');
    await otherTab.evaluate(
        ({ documentIds, update }) => {
            const channel = new BroadcastChannel('reactor');

            documentIds.forEach((documentId) =>
                channel.postMessage({ type: 'update', documentId, update: new Uint8Array(update) })
            );
        },
        { documentIds: await savedDocumentIds(page), update: [...Y.encodeStateAsUpdate(doc)] }
    );
}

test('a copy older than the document goes view only and offers Reload', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await expect(shapes(page)).toHaveCount(1);

    await editInNewerTab(page, 1_000_000);

    const notice = page.getByRole('alert');
    await expect(notice).toContainText('A newer version of Reactor changed this document');
    // The editor gives way to the read-only viewer, so nothing can be drawn over the newer copy.
    await expect(page.locator('svg#surface')).toHaveCount(0);

    await notice.getByRole('button', { name: 'Reload' }).click();

    // The newer change never reached this browser's saved copy, so after reloading it edits again.
    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(shapes(page)).toHaveCount(1);
});
