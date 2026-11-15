import { expect, test, type Page } from '@playwright/test';
import { Collaboration } from 'src/app/services/collaboration';
import { createDocument, createShape } from 'src/app/factories';
import { DEFAULT_DOCUMENT_SIZE } from 'src/app/services/documentSize';
import type { Document } from 'src/app/types';

const user = { id: 'move-documents-user', name: 'Ada', email: 'ada@example.com' };
const image = { hash: 'cafe', type: 'image/png', bytes: [137, 80, 78, 71] };

/** A document holding one shape, an image when `withImage`, named `text` when given. */
function drawing(id: string, name: string, withImage = false, text = 'shape'): Document {
    const document = createDocument({ id, name });
    const shape = createShape({
        ...(withImage
            ? { type: 'image' as const, source: `asset:${image.hash}` }
            : { type: 'rectangle' as const }),
        position: { x: 0, y: 0 },
        size: { width: 20, height: 10 },
        order: 'a0',
        name: text
    });

    document.shapes[shape.id] = shape;

    return document;
}

/** A document's whole shared state, base64-encoded to pass into the page. */
async function stateOf(document: Document) {
    const collaboration = new Collaboration();
    await collaboration.initialize({
        getDocument: () => document,
        applyRemoteChanges: () => {},
        addMutationListener: () => () => {}
    });
    collaboration.open(document.id);
    const state = Buffer.from(collaboration.state(document.id)).toString('base64');
    collaboration.dispose();

    return state;
}

/** The ids of the documents an IndexedDB database of the page keeps. */
const documentIds = (page: Page, name: string) =>
    page.evaluate(
        (name) =>
            new Promise<string[]>((resolve, reject) => {
                const opening = indexedDB.open(name);
                opening.onerror = () => reject(opening.error);
                opening.onsuccess = () => {
                    const db = opening.result;
                    const listing = db
                        .transaction('documents')
                        .objectStore('documents')
                        .getAllKeys();
                    listing.onsuccess = () => {
                        db.close();
                        resolve(listing.result.map(String).sort());
                    };
                };
            }),
        name
    );

/** Whether the account's database in the page keeps `image`. */
const accountHasImage = (page: Page) =>
    page.evaluate(
        ({ name, hash }) =>
            new Promise<boolean>((resolve, reject) => {
                const opening = indexedDB.open(name);
                opening.onerror = () => reject(opening.error);
                opening.onsuccess = () => {
                    const db = opening.result;
                    const reading = db.transaction('assets').objectStore('assets').get(hash);
                    reading.onsuccess = () => {
                        db.close();
                        resolve(reading.result !== undefined);
                    };
                };
            }),
        { name: `reactor-${user.id}`, hash: image.hash }
    );

/**
 * This browser keeps `documents` signed out, with `image`; then Ada signs in to a
 * server whose personal workspace starts empty. Returns the ids the server is asked
 * to create.
 */
async function signInWith(page: Page, documents: Document[]) {
    const states = await Promise.all(
        documents.map(async (document) => ({ id: document.id, state: await stateOf(document) }))
    );
    const created: string[] = [];

    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.goto('/documents');
    await expect(page.getByRole('heading', { name: 'Documents' }).first()).toBeVisible();
    await page.evaluate(
        async ({ states, image }) => {
            const opening = indexedDB.open('reactor');
            await new Promise<void>((resolve, reject) => {
                opening.onerror = () => reject(opening.error);
                opening.onsuccess = () => {
                    const db = opening.result;
                    const transaction = db.transaction(
                        ['documents', 'updates', 'assets'],
                        'readwrite'
                    );
                    for (const { id, state } of states) {
                        transaction.objectStore('documents').put({ id });
                        transaction.objectStore('updates').add({
                            documentId: id,
                            update: Uint8Array.from(atob(state), (c) => c.charCodeAt(0))
                        });
                    }
                    transaction
                        .objectStore('assets')
                        .put({ ...image, bytes: new Uint8Array(image.bytes) });
                    transaction.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    transaction.onerror = () => reject(transaction.error);
                };
            });
        },
        { states, image }
    );

    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: { user } }));
    await page.route('**/api/workspaces', (route) =>
        route.fulfill({
            json: [{ id: 'personal', kind: 'personal', name: 'Ada', role: 'admin', ai: true }]
        })
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

    return created;
}

const offer = (page: Page) =>
    page.getByRole('dialog', { name: 'Move documents into your account?' });

test('moves signed-out documents into the account with their images, but not one too large', async ({
    page
}) => {
    const created = await signInWith(page, [
        drawing('plan', 'Plan', true),
        drawing('large', 'Large', false, 'x'.repeat(DEFAULT_DOCUMENT_SIZE.uploadBytes))
    ]);

    await page.reload();

    const dialog = offer(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('listitem')).toHaveCount(2);
    await expect(dialog.getByRole('listitem').filter({ hasText: 'Large' })).toContainText(
        'Too large to move'
    );
    await dialog.getByRole('button', { name: 'Move document' }).click();

    await expect(dialog).toBeHidden();
    await expect(
        page.getByText(
            'Moved one document into your account; one document too large to move stayed in this browser.'
        )
    ).toBeVisible();
    await expect(page.getByText('Plan', { exact: true }).first()).toBeVisible();
    await expect.poll(() => created).toContain('plan');
    expect(created).not.toContain('large');
    expect(await documentIds(page, `reactor-${user.id}`)).toContain('plan');
    expect(await accountHasImage(page)).toBe(true);
    expect(await documentIds(page, 'reactor')).toContain('large');
    expect(await documentIds(page, 'reactor')).not.toContain('plan');

    // Asked once: the document too large is not offered again.
    await page.reload();
    await expect(page.getByText('Plan', { exact: true }).first()).toBeVisible();
    await expect(offer(page)).toHaveCount(0);
});

test('keeps signed-out documents in this browser when skipped, and does not ask again', async ({
    page
}) => {
    const created = await signInWith(page, [drawing('plan', 'Plan')]);

    // Escape only puts the question off until the next start.
    await page.reload();
    await expect(offer(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(offer(page)).toBeHidden();
    await page.reload();
    await offer(page).getByRole('button', { name: 'Keep in this browser' }).click();

    await expect(offer(page)).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Documents' }).first()).toBeVisible();
    await expect(offer(page)).toHaveCount(0);
    await expect(page.getByText('Plan', { exact: true })).toHaveCount(0);
    expect(created).not.toContain('plan');
    expect(await documentIds(page, 'reactor')).toContain('plan');
});
