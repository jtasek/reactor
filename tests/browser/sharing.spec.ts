import { expect, test, type Page } from '@playwright/test';
import { Collaboration } from '../../src/app/services/collaboration';
import { createDocument, createShape } from '../../src/app/factories';

const user = { id: 'sharing-user', name: 'Ada', email: 'ada@example.com' };
const token = 'a'.repeat(64);
const workspace = { id: 'workspace', name: 'Design team', kind: 'team', role: 'admin' };
const invitation = {
    id: 'invitation',
    email: 'recipient@example.com',
    role: 'viewer',
    createdAt: '2026-10-18T10:00:00Z',
    expiresAt: '2026-10-25T10:00:00Z'
};

async function account(page: Page, signedIn = true) {
    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({ json: signedIn ? { user } : null })
    );
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [workspace] }));
    await page.route('**/api/workspaces/*/members', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/workspaces/*/documents', (route) =>
        route.fulfill({ status: 503, json: {} })
    );
    await page.route('**/api/sign-in/providers', (route) => route.fulfill({ json: [] }));
}

test('creates a scoped invitation link and revokes it at narrow and normal widths', async ({
    page
}) => {
    await account(page);
    const older = { ...invitation, id: 'older', email: 'previous@example.com' };
    let pending: object[] = [older];
    await page.route('**/api/workspaces/workspace/invitations', async (route) => {
        if (route.request().method() === 'POST') {
            expect(route.request().postDataJSON()).toEqual({
                email: 'recipient@example.com',
                role: 'viewer'
            });
            pending = [older, invitation];
            await route.fulfill({ status: 201, json: { ...invitation, token } });
        } else await route.fulfill({ json: pending });
    });
    await page.route('**/api/workspaces/workspace/invitations/invitation', async (route) => {
        expect(route.request().method()).toBe('DELETE');
        pending = [];
        await route.fulfill({ status: 204 });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route('**/api/workspaces/workspace/invitations/older', (route) =>
        route.fulfill({ status: 204 })
    );
    await page.goto('/sharing');
    await page.getByLabel('Email', { exact: true }).fill('recipient@example.com');
    await page.getByRole('combobox', { name: 'Access', exact: true }).selectOption('viewer');
    await page.getByRole('button', { name: 'Create invitation', exact: true }).click();
    await expect(page.getByLabel('Invitation link')).toHaveValue(
        `http://127.0.0.1:4173/invite#${token}`
    );
    await expect(
        page.getByRole('region', { name: 'Pending invitations' }).getByRole('list')
    ).toContainText('recipient@example.com');
    await expect(page.getByText('including documents added later.')).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-sharing-normal.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Copy invitation link' })).toBeVisible();
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    await page.screenshot({ path: '/tmp/reactor-sharing-narrow.png' });
    await page.getByRole('button', { name: 'Revoke invitation for previous@example.com' }).click();
    await expect(
        page.getByRole('button', { name: 'Revoke invitation for previous@example.com' })
    ).toHaveCount(0);
    await expect(page.getByLabel('Invitation link')).toHaveValue(
        `http://127.0.0.1:4173/invite#${token}`
    );
    await page.getByRole('button', { name: 'Revoke invitation for recipient@example.com' }).click();
    await expect(page.getByText('No pending invitations.')).toBeVisible();
    await expect(page.getByLabel('Invitation link')).toHaveCount(0);
});

test('inspects without joining and accepts only after explicit confirmation', async ({ page }) => {
    await account(page);
    let accepted = 0;
    const requests: string[] = [];
    await page.route('**/api/invitations/*', async (route) => {
        requests.push(route.request().url());
        expect(route.request().postDataJSON()).toEqual({ token });
        if (route.request().url().endsWith('/accept')) {
            accepted++;
            await route.fulfill({ json: { workspaceId: 'workspace', role: 'viewer' } });
        } else
            await route.fulfill({
                json: { ...invitation, workspaceName: 'Design team', accepted: false }
            });
    });
    await page.goto(`/invite#${token}`);
    await expect(page.getByRole('heading', { name: 'Join Design team' })).toBeVisible();
    expect(accepted).toBe(0);
    await expect(page.getByText('You can view documents but cannot change them.')).toBeVisible();
    await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
    await expect(page).toHaveURL('/documents');
    expect(accepted).toBe(1);
    expect(requests.every((url) => !url.includes(token))).toBe(true);
});

test('preserves the invitation when requesting an email sign-in link', async ({ page }) => {
    await account(page, false);
    await page.route('**/api/auth/sign-in/magic-link', async (route) => {
        expect(route.request().postDataJSON()).toEqual({
            email: 'recipient@example.com',
            callbackURL: '/invite'
        });
        await route.fulfill({ json: { status: true } });
    });
    await page.goto(`/invite#${token}`);
    await page.getByRole('button', { name: 'Sign in with a link', exact: true }).click();
    await page.getByLabel('Email', { exact: true }).fill('recipient@example.com');
    await page.getByRole('button', { name: 'Email me a link' }).click();
    await expect(page.getByRole('status')).toContainText('Check recipient@example.com');
});

test('preserves invitation fragments through social sign-in and its error callback', async ({
    page
}) => {
    await account(page, false);
    await page.route('**/api/sign-in/providers', (route) => route.fulfill({ json: ['google'] }));
    await page.route('**/api/auth/sign-in/social', async (route) => {
        expect(route.request().postDataJSON()).toMatchObject({
            callbackURL: '/invite',
            errorCallbackURL: '/invite?oauth=failed'
        });
        await route.fulfill({ json: { url: 'https://identity.example.test/authorize' } });
    });
    await page.route('https://identity.example.test/authorize', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<h1>Provider sign-in</h1>' })
    );
    await page.goto(`/invite#${token}`);
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page).toHaveURL('https://identity.example.test/authorize');
    await page.goto('/invite?oauth=failed');
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Social sign-in was not completed');
});

test('explains mismatched or expired invitations without offering acceptance', async ({ page }) => {
    await account(page);
    await page.route('**/api/invitations/inspect', (route) =>
        route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
    );
    await page.goto(`/invite#${token}`);
    await expect(page.getByRole('alert')).toContainText('Check the signed-in email');
    await expect(page.getByRole('button', { name: 'Accept invitation', exact: true })).toHaveCount(
        0
    );
});

test('cached viewers can read and zoom but cannot use editor controls or rename/delete documents', async ({
    page
}) => {
    await account(page, false);
    await page.goto('/account');
    const shape = createShape({
        id: 'box',
        type: 'rectangle',
        name: 'Box',
        position: { x: 10, y: 20 },
        size: { width: 200, height: 100 },
        fill: '#3366ff',
        order: 'a0'
    });
    const document = createDocument({
        id: 'shared',
        name: 'Shared sketch',
        shapes: { [shape.id]: shape }
    });
    const collaboration = new Collaboration();
    await collaboration.initialize({
        getDocument: () => document,
        applyRemoteChanges: () => {},
        addMutationListener: () => () => {}
    });
    collaboration.open('shared');
    const update = Array.from(collaboration.state('shared'));
    collaboration.dispose();
    await page.evaluate(
        async ({ update, user }) => {
            localStorage.setItem('reactor:account', user.id);
            localStorage.setItem(
                `reactor:server:${user.id}`,
                JSON.stringify({ unsent: [], deleting: [] })
            );
            localStorage.setItem(
                `reactor:server:${user.id}:access`,
                JSON.stringify({ shared: { workspaceId: 'workspace', role: 'viewer' } })
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
                    transaction.objectStore('documents').put({ id: 'shared' });
                    transaction
                        .objectStore('updates')
                        .add({ documentId: 'shared', update: new Uint8Array(update) });
                    transaction.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    transaction.onerror = () => reject(transaction.error);
                };
            });
        },
        { update, user }
    );
    await account(page);
    await page.goto('/documents');
    await expect(
        page.getByRole('button', { name: 'Rename Shared sketch', exact: true })
    ).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Delete Shared sketch', exact: true })
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Open Shared sketch', exact: true }).click();
    await expect(
        page.getByText('View only — changes from editors appear here automatically.')
    ).toBeVisible();
    await expect(page.getByRole('img', { name: 'Preview of Shared sketch' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Application', exact: true })).toHaveCount(0);
    await page.keyboard.press('r');
    await page.keyboard.press('Delete');
    await expect(page.locator('svg#surface')).toHaveCount(0);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.getByRole('img', { name: 'Preview of Shared sketch' })).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-sharing-viewer.png' });
});

test('password sign-in returns to the invitation for explicit acceptance', async ({ page }) => {
    await account(page, false);
    let signedIn = false;
    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({ json: signedIn ? { user } : null })
    );
    await page.route('**/api/auth/sign-in/email', async (route) => {
        signedIn = true;
        await route.fulfill({ json: { user } });
    });
    await page.route('**/api/invitations/inspect', (route) =>
        route.fulfill({ json: { ...invitation, workspaceName: 'Design team', accepted: false } })
    );
    await page.goto(`/invite#${token}`);
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('correct horse');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(`/invite#${token}`);
    await expect(
        page.getByRole('button', { name: 'Accept invitation', exact: true })
    ).toBeVisible();
});

test('switching invitation fragments hides the old proposal and uses the token currently shown in the URL', async ({
    page
}) => {
    await account(page);
    const next = 'b'.repeat(64);
    await page.route('**/api/invitations/inspect', async (route) => {
        const { token: inspected } = route.request().postDataJSON();
        await route.fulfill({
            json: {
                ...invitation,
                workspaceName: inspected === token ? 'First workspace' : 'Second workspace',
                accepted: false
            }
        });
    });
    await page.goto(`/invite#${token}`);
    await expect(page.getByRole('heading', { name: 'Join First workspace' })).toBeVisible();
    await page.evaluate((next) => {
        window.location.hash = next;
    }, next);
    await expect(page.getByRole('heading', { name: 'Join Second workspace' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Join First workspace' })).toHaveCount(0);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Join First workspace' })).toBeVisible();
    await page.evaluate((next) => {
        const link = document.createElement('a');
        link.href = `/invite#${next}`;
        link.textContent = 'Another invitation';
        document.body.append(link);
    }, next);
    await page.getByRole('link', { name: 'Another invitation' }).click();
    await expect(page).toHaveURL(`/invite#${next}`);
    await expect(page.getByRole('heading', { name: 'Join Second workspace' })).toBeVisible();
});

test('waits for the initial invitation list before enabling creation so a stale list cannot replace the result', async ({
    page
}) => {
    await account(page);
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/api/workspaces/workspace/invitations', async (route) => {
        await ready;
        await route.fulfill({ json: [] });
    });
    await page.goto('/sharing');
    await page.getByLabel('Email', { exact: true }).fill('recipient@example.com');
    await expect(
        page.getByRole('button', { name: 'Create invitation', exact: true })
    ).toBeDisabled();
    release();
    await expect(
        page.getByRole('button', { name: 'Create invitation', exact: true })
    ).toBeEnabled();
});

test('admins manage editor/viewer members, confirm removals, and cannot edit protected owners', async ({
    page
}) => {
    await account(page);
    const member = {
        id: 'member',
        name: 'Grace',
        email: 'recipient@example.com',
        image: null,
        role: 'editor',
        owner: false
    };
    await page.route('**/api/workspaces/workspace/members', (route) =>
        route.fulfill({ json: [{ ...user, image: null, role: 'admin', owner: true }, member] })
    );
    await page.route('**/api/workspaces/workspace/invitations', (route) =>
        route.fulfill({
            json: route.request().method() === 'POST' ? { ...invitation, token } : [invitation]
        })
    );
    let removed = false;
    await page.route('**/api/workspaces/workspace/members/member', async (route) => {
        if (route.request().method() === 'PATCH')
            expect(route.request().postDataJSON()).toEqual({ role: 'viewer' });
        else {
            expect(route.request().method()).toBe('DELETE');
            removed = true;
        }
        await route.fulfill({ status: 204 });
    });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/sharing');
    await page.getByLabel('Email', { exact: true }).fill(member.email);
    await page.getByRole('button', { name: 'Create invitation', exact: true }).click();
    await expect(page.getByLabel('Invitation link')).toBeVisible();
    await page
        .getByRole('combobox', { name: 'Access for recipient@example.com' })
        .selectOption('viewer');
    await expect(
        page.getByRole('combobox', { name: 'Access for recipient@example.com' })
    ).toHaveValue('viewer');
    await expect(
        page.getByRole('button', { name: 'Remove ada@example.com', exact: true })
    ).toHaveCount(0);
    const region = page.getByRole('region', { name: 'Members', exact: true });
    await region.scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/reactor-members-normal.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await region.scrollIntoViewIfNeeded();
    await expect(
        page.getByRole('button', { name: 'Remove recipient@example.com', exact: true })
    ).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-members-narrow.png' });
    await page.getByRole('button', { name: 'Remove recipient@example.com', exact: true }).click();
    expect(removed).toBe(false);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Remove recipient@example.com', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
    await expect(region.getByText('Grace', { exact: true })).toHaveCount(0);
    expect(removed).toBe(true);
    await expect(page.getByText('No pending invitations.')).toBeVisible();
    await expect(page.getByLabel('Invitation link')).toHaveCount(0);
});
