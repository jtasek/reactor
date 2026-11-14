import { expect, test, type Browser, type Page } from '@playwright/test';
import { Hocuspocus } from '@hocuspocus/server';
import { Collaboration } from 'src/app/services/collaboration';
import { createDocument, createShape } from 'src/app/factories';
import { peerColor } from 'src/app/services/presence';
import { stampPresence, type PresenceUser } from '../../server/presence';
import { firstShape } from './support/editor';

const shape = createShape({
    id: 'box',
    type: 'rectangle',
    name: 'Box',
    position: { x: 200, y: 200 },
    size: { width: 160, height: 100 },
    fill: '#3366ff',
    order: 'a0'
});
const plan = createDocument({ id: 'plan', name: 'Plan', shapes: { [shape.id]: shape } });

/** The document's whole shared state, as both browsers saved it. */
async function planState() {
    const collaboration = new Collaboration();
    await collaboration.initialize({
        getDocument: () => plan,
        applyRemoteChanges: () => {},
        addMutationListener: () => () => {}
    });
    collaboration.open(plan.id);
    const state = Array.from(collaboration.state(plan.id));
    collaboration.dispose();

    return state;
}

/**
 * The sync server, in the test: the same Hocuspocus and presence checks as the
 * server's, without accounts or a database. Each browser's socket is passed to it
 * as the person `user` signed in.
 */
function syncServer() {
    const hocuspocus = new Hocuspocus<PresenceUser>({
        quiet: true,
        async beforeHandleAwareness(payload) {
            stampPresence(payload);
        }
    });

    const connect = async (page: Page, user: PresenceUser) => {
        await page.routeWebSocket(/\/sync(\?|$)/, (socket) => {
            let open = true;
            const connection = hocuspocus.handleConnection(
                {
                    get readyState() {
                        return open ? 1 : 3;
                    },
                    send: (data) => {
                        if (open) socket.send(Buffer.from(data as Uint8Array));
                    },
                    close: (code, reason) => {
                        open = false;
                        void socket.close({ code, reason });
                    }
                },
                new Request('http://127.0.0.1:4173/sync'),
                user
            );

            socket.onMessage((message) =>
                connection.handleMessage(new Uint8Array(message as Buffer))
            );
            const closed = (code = 1000, reason = '') => {
                if (open) {
                    open = false;
                    connection.handleClose({ code, reason });
                }
            };

            socket.onClose(closed);
            // A closed tab's socket ends without a close message reaching the route.
            page.once('close', () => closed());
        });
    };

    return { connect };
}

/** A browser of `user`'s, signed in, which holds the plan and shows it. */
async function signIn(
    browser: Browser,
    server: ReturnType<typeof syncServer>,
    user: { id: string; name: string; email: string }
) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const update = await planState();

    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.goto('/login');
    await page.evaluate(
        async ({ update, id, user }) => {
            localStorage.setItem('reactor:notices', '["first","many"]');
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
                JSON.stringify({ [id]: { workspaceId: 'workspace', role: 'editor' } })
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
        { update, id: plan.id, user }
    );
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: { user } }));
    await page.route('**/api/workspaces', (route) =>
        route.fulfill({ json: [{ id: 'workspace', kind: 'team', name: 'Team', role: 'editor' }] })
    );
    await page.route('**/api/workspaces/*/documents', (route) =>
        route.fulfill({
            json: [
                {
                    id: plan.id,
                    workspaceId: 'workspace',
                    name: plan.name,
                    createdAt: '2026-11-14T10:00:00Z',
                    updatedAt: '2026-11-14T10:00:00Z'
                }
            ]
        })
    );
    await page.route('**/api/documents/*/assets', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/ai', (route) => route.fulfill({ json: { available: false } }));
    await server.connect(page, { userId: user.id, name: user.name });
    await page.goto('/');
    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(firstShape(page)).toBeVisible();

    return { page, context };
}

const pointerOf = (page: Page, name: string) =>
    page.locator(`svg#surface [data-presence-pointer="${name}"]`);
const selectionOf = (page: Page, name: string) =>
    page.locator(`svg#surface [data-presence-selection="${name}"] rect`);

test('two people see each other’s pointers and selections', async ({ browser }) => {
    const server = syncServer();
    const browsers = [
        await signIn(browser, server, { id: 'ada', name: 'Ada', email: 'ada@example.com' }),
        await signIn(browser, server, { id: 'grace', name: 'Grace', email: 'grace@example.com' })
    ];
    const [ada, grace] = browsers.map(({ page }) => page);

    // The browsers made here are no fixtures, so the test closes them however it ends.
    try {
        await sees(ada, grace);
    } finally {
        await Promise.all(browsers.map(({ context }) => context.close()));
    }
});

/** Ada and Grace see each other's pointers and selections, until Grace leaves. */
async function sees(ada: Page, grace: Page) {
    // Ada points at the box and selects it; Grace sees where, named and in Ada's color.
    const box = (await firstShape(ada).boundingBox())!;
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    await ada.mouse.move(center.x, center.y);
    await ada.mouse.down();
    await ada.mouse.up();
    await expect(pointerOf(grace, 'Ada')).toBeVisible();
    await expect(pointerOf(grace, 'Ada')).toContainText('Ada');
    await expect(pointerOf(grace, 'Ada').locator('path')).toHaveAttribute('fill', peerColor('ada'));
    await expect(selectionOf(grace, 'Ada')).toHaveCount(1);

    // The pointer is drawn where Ada's is, over the same shape on Grace's canvas.
    const arrow = (await pointerOf(grace, 'Ada').locator('path').boundingBox())!;
    expect(Math.abs(arrow.x - center.x)).toBeLessThan(4);
    expect(Math.abs(arrow.y - center.y)).toBeLessThan(4);
    const outline = (await selectionOf(grace, 'Ada').boundingBox())!;
    const graceBox = (await firstShape(grace).boundingBox())!;
    expect(outline.x).toBeLessThan(graceBox.x);
    expect(outline.x + outline.width).toBeGreaterThan(graceBox.x + graceBox.width);

    // Nobody sees their own pointer as someone else's.
    await expect(ada.locator('[data-presence-pointer]')).toHaveCount(0);

    // Grace points too, and Ada sees her; once Grace leaves the canvas her pointer goes.
    await grace.mouse.move(100, 400);
    await expect(pointerOf(ada, 'Grace')).toBeVisible();
    await expect(selectionOf(ada, 'Grace')).toHaveCount(0);
    await ada.screenshot({ path: '/tmp/reactor-presence.png' });

    // Ada clears her selection by clicking the empty canvas.
    await ada.mouse.click(60, 700);
    await expect(selectionOf(grace, 'Ada')).toHaveCount(0);

    // Grace closes her tab, and Ada stops seeing her.
    await grace.close();
    await expect(pointerOf(ada, 'Grace')).toHaveCount(0);
}
