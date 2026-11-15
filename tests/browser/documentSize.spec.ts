import { expect, test, type Page } from '@playwright/test';
import { Collaboration } from 'src/app/services/collaboration';
import { createDocument, createShape } from 'src/app/factories';
import { MAX_UPLOAD_BYTES, SIZE_WARNING_BYTES } from 'src/app/services/documentSize';
import { accountCopy } from 'src/app/services/documentSync';

const user = { id: 'document-size-user', name: 'Ada', email: 'ada@example.com' };

/** The whole shared state of a document named `name` whose one shape's name is `text`, base64-encoded. */
async function stateOf(id: string, name: string, text: string) {
    const document = createDocument({ id, name });
    const shape = createShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 20, height: 10 },
        order: 'a0',
        name: text
    });

    document.shapes[shape.id] = shape;

    const collaboration = new Collaboration();
    await collaboration.initialize({
        getDocument: () => document,
        applyRemoteChanges: () => {},
        addMutationListener: () => () => {}
    });
    collaboration.open(id);
    const state = Buffer.from(collaboration.state(id)).toString('base64');
    collaboration.dispose();

    return state;
}

/** Adds a document with `state` to the page's IndexedDB database `database`. */
const seed = (page: Page, database: string, id: string, state: string) =>
    page.evaluate(
        ({ database, id, state }) =>
            new Promise<void>((resolve, reject) => {
                const opening = indexedDB.open(database);
                opening.onerror = () => reject(opening.error);
                opening.onsuccess = () => {
                    const db = opening.result;
                    const transaction = db.transaction(['documents', 'updates'], 'readwrite');
                    transaction.objectStore('documents').put({ id });
                    transaction.objectStore('updates').add({
                        documentId: id,
                        update: Uint8Array.from(atob(state), (c) => c.charCodeAt(0))
                    });
                    transaction.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    transaction.onerror = () => reject(transaction.error);
                };
            }),
        { database, id, state }
    );

const openFromDocuments = async (page: Page, name: string) => {
    await page.goto('/documents');
    await page.getByRole('button', { name: `Open ${name}` }).click();
};

test('warns that a document over 3 MB is growing too large to upload, until dismissed', async ({
    page
}) => {
    const state = await stateOf('big', 'Big', 'x'.repeat(SIZE_WARNING_BYTES));

    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.goto('/documents');
    await expect(page.getByRole('heading', { name: 'Documents' }).first()).toBeVisible();
    await seed(page, 'reactor', 'big', state);
    await openFromDocuments(page, 'Big');

    const warning = page.getByRole('status').filter({ hasText: 'This document is 3.1 MB' });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(
        'Documents over 4.0 MB cannot be uploaded to an account, so they stay in one browser.'
    );
    await warning.getByRole('button', { name: 'Dismiss' }).click();
    await expect(warning).toBeHidden();
});

test('explains a document kept in this browser as too large for its first upload', async ({
    page
}) => {
    const state = await stateOf('large', 'Large', 'x'.repeat(MAX_UPLOAD_BYTES));
    const { database, recordKey } = accountCopy(user.id);
    const created: string[] = [];
    let online = false;

    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: { user } }));
    await page.route('**/api/workspaces', (route) =>
        online
            ? route.fulfill({
                  json: [{ id: 'personal', kind: 'personal', name: 'Ada', role: 'admin', ai: true }]
              })
            : route.abort()
    );
    await page.route('**/api/workspaces/personal/documents', async (route) => {
        if (route.request().method() === 'POST') {
            created.push((route.request().postDataJSON() as { id: string }).id);
            await route.fulfill({ status: 201, json: {} });
        } else {
            await route.fulfill({ json: created.map((id) => ({ id, name: id })) });
        }
    });
    await page.route('**/api/documents/*/assets', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/ai', (route) => route.fulfill({ status: 404, json: {} }));
    await page.routeWebSocket(/\/sync(\?|$)/, () => {});

    // Made in this browser while the server could not be reached.
    await page.goto('/documents');
    await expect(page.getByRole('heading', { name: 'Documents' }).first()).toBeVisible();
    await expect
        .poll(() => page.evaluate((key) => localStorage.getItem(key), recordKey))
        .not.toBeNull();
    await seed(page, database, 'large', state);
    await page.evaluate((key) => {
        const record = JSON.parse(localStorage.getItem(key)!) as { unsent: string[] };
        localStorage.setItem(
            key,
            JSON.stringify({ ...record, unsent: [...record.unsent, 'large'] })
        );
    }, recordKey);

    online = true;
    await page.reload();
    await expect(
        page.getByText(
            '“Large” is 4.0 MB, more than the server takes at once. It is kept only in this browser until it is smaller.'
        )
    ).toBeVisible();

    await page.getByRole('button', { name: 'Open Large' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Move some screens' })).toContainText(
        'It is kept only in this browser until it is smaller.'
    );
    expect(created).not.toContain('large');
});
