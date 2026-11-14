import { expect, test, type Page } from '@playwright/test';
import { Collaboration } from 'src/app/services/collaboration';
import { createDocument } from 'src/app/factories';
import type { Document } from 'src/app/types';

const user = { id: 'workspace-ai-admin', name: 'Ada', email: 'ada@example.com' };

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

/**
 * Ada signed in on a server offering AI, with `document` saved in this browser and
 * listed in her team's workspace, whose AI switch `ai()` reads.
 */
async function signIn(page: Page, document: Document, ai: () => boolean) {
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
        route.fulfill({
            json: [{ id: 'team', kind: 'team', name: 'Team', role: 'admin', ai: ai() }]
        })
    );
    await page.route('**/api/workspaces/team/documents', (route) =>
        route.fulfill({ json: [{ id: document.id, name: document.name }] })
    );
    await page.route('**/api/workspaces/*/members', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/workspaces/*/invitations', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/ai', (route) => route.fulfill({ json: { available: true } }));
    await page.routeWebSocket(/\/sync(\?|$)/, () => {});
    await page.setViewportSize({ width: 1440, height: 1000 });
}

const editWithWords = (page: Page) =>
    page.getByRole('navigation', { name: 'Application' }).getByRole('button', {
        name: 'Edit with words'
    });

/** The workspace AI switch this browser remembers for the document, once the server has said. */
const remembered = (page: Page, documentId: string) =>
    page.evaluate(
        ({ key, documentId }) => JSON.parse(localStorage.getItem(key) ?? '{}')[documentId]?.aiOff,
        { key: `reactor:server:${user.id}:access`, documentId }
    );

test('hides AI entries while the workspace has AI off, and says when the server refuses', async ({
    page
}) => {
    const document = createDocument({ id: 'workspace-ai-document', name: 'Plan' });
    let ai = true;

    await signIn(page, document, () => ai);
    await page.goto('/');
    await expect(editWithWords(page)).toBeVisible();

    // An admin turns it off; the editor learns it when it next lists the workspaces.
    ai = false;
    const answered = page.waitForResponse('**/api/ai');
    await page.reload();
    await answered;
    await expect.poll(() => remembered(page, document.id)).toBe(true);
    await expect(page.getByRole('navigation', { name: 'Application' })).toBeVisible();
    await expect(editWithWords(page)).toHaveCount(0);
    await page.keyboard.press('w');
    await expect(page.getByRole('group', { name: 'Chat controls' })).toHaveCount(0);

    ai = true;
    await page.reload();
    await expect.poll(() => remembered(page, document.id)).toBe(false);
    await expect(editWithWords(page)).toBeVisible();
    await page.keyboard.press('w');

    const chat = page.getByRole('group', { name: 'Chat controls' });
    await expect(chat.getByText(/sends your words and the selected part/)).toBeVisible();
    await expect(chat.getByText(/does not store your words/)).toBeVisible();

    // An admin turned it off since this copy last asked.
    await page.route('**/api/ai/documents/*/requests', (route) =>
        route.fulfill({ status: 403, json: { code: 'AI_OFF' } })
    );
    await page.getByRole('textbox', { name: 'Change to make' }).fill('Add a button');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(chat.getByRole('alert')).toHaveText('An admin turned AI off for this workspace.');
});

test('lets an admin turn AI off for a workspace on the Sharing page', async ({ page }) => {
    const document = createDocument({ id: 'workspace-ai-sharing', name: 'Plan' });
    const changes: unknown[] = [];
    let ai = true;

    await signIn(page, document, () => ai);
    await page.route('**/api/workspaces/team/ai', async (route) => {
        changes.push(route.request().postDataJSON());
        ai = (route.request().postDataJSON() as { enabled: boolean }).enabled;
        await route.fulfill({ status: 204 });
    });
    await page.goto('/sharing');

    const section = page.getByRole('region', { name: 'AI' });
    const toggle = section.getByRole('checkbox', {
        name: 'Let members use Edit with words in this workspace’s documents'
    });
    await expect(toggle).toBeChecked();
    await expect(section.getByText(/Reactor keeps who asked/)).toBeVisible();

    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(section.getByText(/AI is off/)).toBeVisible();
    expect(changes).toEqual([{ enabled: false }]);

    await toggle.click();
    await expect(toggle).toBeChecked();
    expect(changes).toEqual([{ enabled: false }, { enabled: true }]);
});
