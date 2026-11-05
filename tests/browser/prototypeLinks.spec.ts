import { setPrototypeSetting } from './support/prototypeControls';
import { expect, test, type Page } from '@playwright/test';
import { Collaboration } from 'src/app/services/collaboration';
import { prototypeDocument } from '../support/prototype';
import type { PreviewApplication } from 'src/preview/protocol';

const user = { id: 'prototype-author', name: 'Ada', email: 'ada@example.com' };
const token = 'a'.repeat(43);
const shareURL = `http://127.0.0.1:4194/share#${token}`;

async function openAuthor(page: Page, role: 'admin' | 'editor' = 'admin') {
    const document = prototypeDocument();
    const collaboration = new Collaboration();
    await collaboration.initialize({
        getDocument: () => document,
        applyRemoteChanges: () => {},
        addMutationListener: () => () => {}
    });
    collaboration.open(document.id);
    const update = Array.from(collaboration.state(document.id));
    collaboration.dispose();
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.goto('/login');
    await page.evaluate(
        async ({ update, id, user, role }) => {
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
                JSON.stringify({ [id]: { workspaceId: 'workspace', role } })
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
        { update, id: document.id, user, role }
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
    await page.goto('/prototype');

    return document;
}

test('shares the chosen context as an independent snapshot, plays without cookies, and revokes', async ({
    page,
    context
}) => {
    let snapshot: PreviewApplication | undefined;
    let revoked = false;
    let failCreate = true;
    const link = {
        id: 'link',
        name: 'Mobile dark',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        outdated: false,
        url: shareURL
    };
    await page.route('**/api/documents/*/prototype-links', async (route) => {
        if (route.request().method() === 'POST') {
            if (failCreate) {
                failCreate = false;
                await route.fulfill({ status: 503, json: { code: 'PREVIEW_UNAVAILABLE' } });

                return;
            }
            snapshot = route.request().postDataJSON().application;
            await route.fulfill({ status: 201, json: link });

            return;
        }
        await route.fulfill({ json: snapshot && !revoked ? [link] : [] });
    });
    await page.route('**/api/documents/*/prototype-links/link', async (route) => {
        revoked = true;
        await route.fulfill({ status: 204 });
    });
    await context.route('**/api/prototype-links/open', async (route) => {
        const headers = {
            'access-control-allow-origin': 'http://127.0.0.1:4194',
            'access-control-allow-headers': 'Content-Type',
            'access-control-allow-methods': 'POST'
        };
        if (route.request().method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers });

            return;
        }
        expect(route.request().postDataJSON()).toEqual({ token });
        expect(route.request().headers().cookie).toBeUndefined();
        await route.fulfill({
            status: revoked ? 404 : 200,
            headers,
            json: revoked ? { code: 'NOT_FOUND' } : { version: 3, application: snapshot }
        });
    });
    await openAuthor(page);
    await setPrototypeSetting(page, 'Start screen', 'details');
    await setPrototypeSetting(page, 'Prototype width', '640');
    await setPrototypeSetting(page, 'Prototype Theme', 'dark');
    await page.getByLabel('Preview screen').selectOption('home');
    await page.getByLabel('Preview layout').selectOption(JSON.stringify('home'));
    await expect(page.getByLabel('Preview layout')).toHaveValue(JSON.stringify('home'));
    await page.getByRole('button', { name: 'Share prototype', exact: true }).click();
    const sharing = page.getByRole('dialog', { name: 'Share prototype' });
    await sharing.getByRole('button', { name: 'Create snapshot link' }).click();
    await expect(sharing.getByRole('alert')).toContainText('not configured');
    await sharing.getByRole('button', { name: 'Create snapshot link' }).click();
    await expect(sharing.getByLabel('Snapshot link')).toHaveValue(shareURL);
    expect(snapshot!.screens[0].id).toBe('details');
    expect(snapshot!.screens[0].width).toBe(640);
    expect(snapshot!.screens.find((screen) => screen.id === 'home')?.layoutChoice).toBe('home');
    await page.screenshot({ path: 'test-results/prototype-sharing-wide.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(sharing.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await page.screenshot({ path: 'test-results/prototype-sharing-narrow.png' });
    await sharing.getByRole('button', { name: 'Close sharing' }).click();
    await setPrototypeSetting(page, 'Prototype width', '320');

    await context.addCookies([
        { name: 'private', value: 'editor-session', url: 'http://127.0.0.1:4173' }
    ]);
    const recipient = await context.newPage();
    await recipient.goto(shareURL);
    await expect(recipient.getByRole('combobox', { name: 'Preview screen' })).toHaveValue(
        'details'
    );
    await expect(recipient.locator('svg')).toHaveAttribute('width', '640');
    await expect(recipient.locator('svg text').first()).toHaveCSS('fill', 'rgb(221, 238, 255)');
    await expect(recipient.getByLabel('Preview width')).toHaveCount(0);
    await expect(recipient.getByLabel('Preview layout')).toHaveCount(0);
    await recipient.getByLabel('Preview screen').selectOption('home');
    await recipient.getByRole('textbox', { name: 'Your name' }).fill('Recipient only');
    await recipient.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(recipient.getByLabel('Preview screen')).toHaveValue('details');
    await recipient.getByRole('button', { name: 'Restart prototype' }).click();
    await recipient.getByLabel('Preview screen').selectOption('home');
    await expect(recipient.getByRole('textbox', { name: 'Your name' })).toHaveValue('Your name');
    await page.getByRole('button', { name: 'Share prototype', exact: true }).click();
    await sharing.getByRole('button', { name: 'Revoke Mobile dark' }).click();
    await expect(sharing.getByText('No active links.')).toBeVisible();
    await recipient.reload();
    await expect(recipient.getByRole('status')).toContainText('expired or been revoked');
    await recipient.close();
});

test('public links have a scoped network policy and clear invalid-link errors', async ({
    page,
    request
}) => {
    const response = await request.get('http://127.0.0.1:4194/share');
    expect(response.headers()['content-security-policy']).toContain(
        'connect-src http://127.0.0.1:4173'
    );
    expect(response.headers()['content-security-policy']).not.toContain('connect-src *');
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
    expect(response.headers()['set-cookie']).toBeUndefined();
    expect(
        (await request.get('http://127.0.0.1:4194/')).headers()['content-security-policy']
    ).toContain("connect-src 'none'");
    await page.goto('http://127.0.0.1:4194/share/#invalid');
    await expect(page.getByRole('status')).toHaveText('This prototype link is invalid.');
});

test('signed-out authors get a clear sharing requirement without a publish action', async ({
    page
}) => {
    await page.goto('/prototype');
    await page.getByRole('button', { name: 'Share prototype', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('workspace admin');
    await expect(page.getByRole('button', { name: 'Create snapshot link' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Share prototype', exact: true })).toBeFocused();
});

test('links from an older preview version show as out of date to admins and recipients', async ({
    page,
    context
}) => {
    await page.route('**/api/documents/*/prototype-links', (route) =>
        route.fulfill({
            json: [
                {
                    id: 'old',
                    name: 'App · Details · 390 × 844',
                    created_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                    outdated: true
                }
            ]
        })
    );
    await context.route('**/api/prototype-links/open', (route) =>
        route.fulfill({
            status: route.request().method() === 'OPTIONS' ? 204 : 410,
            headers: {
                'access-control-allow-origin': 'http://127.0.0.1:4194',
                'access-control-allow-headers': 'Content-Type',
                'access-control-allow-methods': 'POST'
            },
            json: { code: 'OUTDATED' }
        })
    );
    await openAuthor(page);
    await page.getByRole('button', { name: 'Share prototype', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Out of date, no longer opens');
    const recipient = await context.newPage();
    await recipient.goto(shareURL);
    await expect(recipient.getByRole('status')).toHaveText(
        'This prototype link is out of date. Ask whoever shared it for a new link.'
    );
});

test('workspace members who are not admins are told only admins can share', async ({ page }) => {
    await openAuthor(page, 'editor');
    await page.getByRole('button', { name: 'Share prototype', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(
        'Only workspace admins can create and revoke public links for this document.'
    );
    await expect(page.getByRole('dialog')).not.toContainText('Save this document');
    await expect(page.getByRole('button', { name: 'Create snapshot link' })).toHaveCount(0);
});
