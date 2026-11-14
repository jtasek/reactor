import { expect, test, type Page } from '@playwright/test';
import { Collaboration } from 'src/app/services/collaboration';
import { createDocument } from 'src/app/factories';
import type { Document } from 'src/app/types';
import { prototypeDocument } from '../support/prototype';

const user = { id: 'history-author', name: 'Ada', email: 'ada@example.com' };

/** A document's whole shared state, as the server keeps it. */
async function stateOf(document: Document) {
    const collaboration = new Collaboration();
    await collaboration.initialize({
        getDocument: () => document,
        applyRemoteChanges: () => {},
        addMutationListener: () => () => {}
    });
    collaboration.open(document.id);
    const state = Array.from(collaboration.state(document.id));
    collaboration.dispose();

    return state;
}

/** Ada signed in, with `document` saved in this browser, which she edits on the server. */
async function signIn(page: Page, document: Document) {
    const update = await stateOf(document);

    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.goto('/login');
    await page.evaluate(
        async ({ update, id, user }) => {
            localStorage.setItem('reactor:account', user.id);
            localStorage.setItem(
                `reactor:view:${user.id}`,
                JSON.stringify({ currentDocumentId: id })
            );
            localStorage.setItem(
                `reactor:server:${user.id}`,
                JSON.stringify({ unsent: [], deleting: [] })
            );
            localStorage.setItem(
                `reactor:server:${user.id}:access`,
                JSON.stringify({ [id]: { workspaceId: 'workspace', role: 'admin' } })
            );
            const opening = indexedDB.open(`reactor-${user.id}`, 2);
            opening.onupgradeneeded = () => {
                const db = opening.result;
                db.createObjectStore('documents', { keyPath: 'id' });
                db.createObjectStore('updates', { autoIncrement: true }).createIndex(
                    'documentId',
                    'documentId'
                );
                db.createObjectStore('assets', { keyPath: 'hash' });
            };
            await new Promise<void>((resolve, reject) => {
                opening.onerror = () => reject(opening.error);
                opening.onsuccess = () => {
                    const db = opening.result;
                    const transaction = db.transaction(['documents', 'updates'], 'readwrite');
                    transaction.objectStore('documents').put({ id });
                    transaction
                        .objectStore('updates')
                        .add({ documentId: id, update: new Uint8Array(update) });
                    transaction.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    transaction.onerror = () => reject(transaction.error);
                };
            });
        },
        { update, id: document.id, user }
    );
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: { user } }));
    await page.route('**/api/workspaces', (route) =>
        route.fulfill({ json: [{ id: 'workspace', kind: 'team', name: 'Team', role: 'admin' }] })
    );
    await page.route('**/api/workspaces/*/documents', (route) =>
        route.fulfill({ status: 503, json: {} })
    );
    await page.route('**/api/ai', (route) => route.fulfill({ json: { available: false } }));
    await page.setViewportSize({ width: 1440, height: 1000 });
}

test('Document history shows earlier versions and restores the one chosen', async ({ page }) => {
    const document = createDocument({ id: 'history-document', name: 'Plan' });
    const earlier = prototypeDocument();
    earlier.id = document.id;
    const snapshot = await stateOf(earlier);
    const restores: string[] = [];
    const hour = new Date();
    hour.setMinutes(0, 0, 0);

    await signIn(page, document);
    await page.route(`**/api/documents/${document.id}/history`, (route) =>
        route.fulfill({
            json: [
                {
                    id: 'newer',
                    createdAt: hour.toISOString(),
                    reason: 'scheduled',
                    version: 999,
                    size: 10,
                    restorable: false
                },
                {
                    id: 'earlier',
                    createdAt: new Date(hour.getTime() - 60 * 60 * 1000).toISOString(),
                    reason: 'before-restore',
                    version: 1,
                    size: snapshot.length,
                    restorable: true
                }
            ]
        })
    );
    await page.route(`**/api/documents/${document.id}/history/earlier`, (route) =>
        route.fulfill({ contentType: 'application/octet-stream', body: Buffer.from(snapshot) })
    );
    await page.route(`**/api/documents/${document.id}/history/earlier/restore`, (route) => {
        restores.push(route.request().method());
        return route.fulfill({ status: 204 });
    });
    await page.goto('/');

    const command = page
        .getByRole('list', { name: 'Commands', exact: true })
        .getByRole('button', { name: 'Document history', exact: true });
    await command.click();

    const dialog = page.getByRole('dialog', { name: 'Document history' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);

    const versions = dialog.getByRole('list', { name: 'Versions' }).getByRole('button');
    await expect(versions).toHaveCount(2);
    await expect(versions.first()).toContainText('Made by a newer version of Reactor');
    await expect(versions.nth(1)).toContainText('Before a restore');

    const restore = dialog.getByRole('button', { name: 'Restore this version' });
    await expect(restore).toBeDisabled();

    // A version a newer release made can be seen but not restored.
    await versions.first().click();
    await expect(restore).toBeDisabled();

    await versions.nth(1).click();
    await expect(versions.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('figure', { name: 'Preview' }).locator('svg')).toBeVisible();
    await expect(restore).toBeEnabled();

    await restore.click();
    await expect(dialog).toHaveCount(0);
    expect(restores).toEqual(['POST']);
    await expect(page.getByText('Restored “Plan” to')).toBeVisible();
});

test('Document history says when there is nothing to restore yet', async ({ page }) => {
    const document = createDocument({ id: 'new-history-document', name: 'Fresh' });

    await signIn(page, document);
    // A document the server does not have yet answers as missing.
    await page.route(`**/api/documents/${document.id}/history`, (route) =>
        route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
    );
    await page.goto('/');
    await page
        .getByRole('list', { name: 'Commands', exact: true })
        .getByRole('button', { name: 'Document history', exact: true })
        .click();

    const dialog = page.getByRole('dialog', { name: 'Document history' });
    await expect(dialog).toContainText('No earlier versions yet');
    await expect(dialog.getByRole('button', { name: 'Restore this version' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
});

test('Recently Deleted restores a document the server still keeps', async ({ page }) => {
    const document = createDocument({ id: 'kept-document', name: 'Current' });
    const restored: string[] = [];

    await signIn(page, document);
    await page.route('**/api/workspaces/workspace/deleted-documents', (route) =>
        route.fulfill({
            json: [{ id: 'old-plan', name: 'Old plan', deletedAt: '2026-11-01T10:00:00.000Z' }]
        })
    );
    await page.route('**/api/workspaces/workspace/deleted-documents/old-plan/restore', (route) => {
        restored.push(route.request().method());
        return route.fulfill({
            status: 201,
            json: { id: 'restored-plan', name: 'Old plan', createdAt: '', updatedAt: '' }
        });
    });
    await page.goto('/documents');

    // Nothing is in this browser's Recently Deleted, but the server keeps a document.
    await page.getByRole('button', { name: 'Recently Deleted' }).click();

    const kept = page.getByRole('region', { name: 'Kept on the server' });
    await expect(kept).toContainText('Old plan');
    await kept.getByRole('button', { name: 'Restore Old plan' }).click();

    await expect(page.getByText('Restored “Old plan” to Documents')).toBeVisible();
    await expect(kept).toHaveCount(0);
    expect(restored).toEqual(['POST']);
});
