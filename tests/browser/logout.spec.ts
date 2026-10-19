import { expect, test } from '@playwright/test';
import { Collaboration } from '../../src/app/services/collaboration';
import { createDocument } from '../../src/app/factories';

const user = { id: 'logout-ada', name: 'Ada', email: 'ada@example.com' };

test('signing out clears the account copy and returns to login while preserving local documents', async ({
    page
}) => {
    let signedIn = true;
    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({ json: signedIn ? { user } : null })
    );
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/sign-in/providers', (route) =>
        route.fulfill({ json: ['google', 'github'] })
    );
    await page.route('**/api/auth/sign-out', async (route) => {
        expect(route.request().method()).toBe('POST');
        signedIn = false;
        await route.fulfill({ json: { success: true } });
    });
    const document = createDocument({ id: 'local-sketch', name: 'Local sketch' });
    const collaboration = new Collaboration();
    await collaboration.initialize({
        getDocument: () => document,
        applyRemoteChanges: () => {},
        addMutationListener: () => () => {}
    });
    collaboration.open(document.id);
    const update = Array.from(collaboration.state(document.id));
    collaboration.dispose();

    // Keep a local document separate from the signed-in account's database.
    await page.goto('/documents');
    await page.evaluate(async (update) => {
        const opening = indexedDB.open('reactor', 2);
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
            opening.onsuccess = () => {
                const db = opening.result;
                const transaction = db.transaction(['documents', 'updates'], 'readwrite');
                transaction.objectStore('documents').put({ id: 'local-sketch' });
                transaction.objectStore('updates').add({
                    documentId: 'local-sketch',
                    update: new Uint8Array(update)
                });
                transaction.oncomplete = () => {
                    db.close();
                    resolve();
                };
                transaction.onerror = () => reject(transaction.error);
            };
            opening.onerror = () => reject(opening.error);
        });
    }, update);
    await page.getByRole('link', { name: 'Ada', exact: true }).click();
    await expect(page).toHaveURL('/account');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    const saved = await page.evaluate(async () => ({
        owner: localStorage.getItem('reactor:account'),
        permissions: localStorage.getItem('reactor:server:logout-ada:access'),
        record: localStorage.getItem('reactor:server:logout-ada'),
        databases: (await indexedDB.databases()).map(({ name }) => name)
    }));
    expect(saved.owner).toBe('');
    expect(saved.permissions).toBeNull();
    expect(saved.record).toBeNull();
    expect(saved.databases).not.toContain('reactor-logout-ada');
    expect(saved.databases).toContain('reactor');
    await page.getByRole('link', { name: 'Continue without signing in' }).click();
    await expect(
        page.getByRole('button', { name: 'Open Local sketch', exact: true })
    ).toBeVisible();
});

test('a failed sign-out retains the session and offers retry', async ({ page }) => {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: { user } }));
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/auth/sign-out', (route) => route.fulfill({ status: 503, json: {} }));
    await page.goto('/account');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Something went wrong');
    await expect(page).toHaveURL('/account');
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => localStorage.getItem('reactor:account'))).toBe(user.id);
});

test('a missing authentication chunk shows an error and sign-out can be retried', async ({
    page
}) => {
    let signedIn = true;
    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({ json: signedIn ? { user } : null })
    );
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/sign-in/providers', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/auth/sign-out', async (route) => {
        signedIn = false;
        await route.fulfill({ json: { success: true } });
    });
    await page.goto('/account');
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await page.route('**/*.js', (route) => route.abort());
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('The server could not be reached. Try again.');
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeEnabled();
    expect(signedIn).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('reactor:account'))).toBe(user.id);
    await page.unroute('**/*.js');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
});
