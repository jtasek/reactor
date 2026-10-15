import { expect, test, type Page } from '@playwright/test';
import { openEditor, shapes } from './support/editor';

const SIGN_IN_BUTTON = {
    op: 'addShape',
    key: 'button',
    shape: {
        type: 'rectangle',
        name: 'Sign in',
        position: { x: 300, y: 200 },
        size: { width: 120, height: 40 }
    }
};

/** Signs a person in on a server offering AI, which answers each request with `answer`. */
async function signInWithAi(page: Page, answer: (body: object) => Promise<string> | string) {
    const requests: object[] = [];

    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({
            json: { user: { id: 'user-ada', name: 'Ada', email: 'ada@example.com' } }
        })
    );
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/ai', (route) => route.fulfill({ json: { available: true } }));
    await page.route('**/api/ai/documents/*/requests', async (route) => {
        const body = route.request().postDataJSON() as object;

        requests.push(body);
        await route.fulfill({ contentType: 'application/x-ndjson', body: await answer(body) });
    });
    await page.routeWebSocket('**/sync', () => {});

    return requests;
}

const lines = (...events: object[]) => events.map((event) => `${JSON.stringify(event)}\n`).join('');

const editWithWords = (page: Page) =>
    page.getByRole('navigation', { name: 'Application' }).getByRole('button', {
        name: 'Edit with words'
    });

test('a change described in words is proposed, then applied once accepted, as one undo step', async ({
    page
}) => {
    const requests = await signInWithAi(page, () =>
        lines(
            { type: 'start', requestId: 'request-1', model: 'claude-haiku-5-5' },
            { type: 'message', text: 'I will add a sign-in button.' },
            { type: 'operation', operation: SIGN_IN_BUTTON },
            { type: 'done' }
        )
    );

    await openEditor(page);
    await editWithWords(page).click();

    const dialog = page.getByRole('dialog', { name: 'Edit with words' });
    const prompt = dialog.getByRole('textbox', { name: 'Change to make' });

    await expect(prompt).toBeFocused();
    await prompt.fill('Add a sign-in button');
    await prompt.press('Enter');

    const proposal = dialog.getByRole('region', { name: 'Proposal' });

    await expect(proposal).toContainText('Add rectangle “Sign in”');
    await expect(proposal).toContainText('I will add a sign-in button.');
    expect(requests).toEqual([
        expect.objectContaining({ task: 'edit', prompt: 'Add a sign-in button' })
    ]);
    await expect(shapes(page)).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Accept' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(shapes(page)).toHaveCount(1);

    await page.keyboard.press('ControlOrMeta+z');
    await expect(shapes(page)).toHaveCount(0);
});

test('cancelling a proposal under way changes nothing and keeps the words', async ({ page }) => {
    await signInWithAi(page, () => new Promise<string>(() => {}));

    await openEditor(page);
    await editWithWords(page).click();

    const dialog = page.getByRole('dialog', { name: 'Edit with words' });
    const prompt = dialog.getByRole('textbox', { name: 'Change to make' });

    await prompt.fill('Add a sign-in button');
    await dialog.getByRole('button', { name: 'Propose' }).click();
    await expect(dialog).toContainText('Waiting for AI…');

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(prompt).toHaveValue('Add a sign-in button');
    await expect(prompt).toBeEditable();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(shapes(page)).toHaveCount(0);
});

test('a refused request says why and offers nothing to accept', async ({ page }) => {
    await signInWithAi(page, () =>
        lines(
            { type: 'start', requestId: 'request-1', model: 'claude-haiku-5-5' },
            { type: 'error', code: 'AI_LIMIT_REACHED' }
        )
    );

    await openEditor(page);
    await editWithWords(page).click();

    const dialog = page.getByRole('dialog', { name: 'Edit with words' });

    await dialog.getByRole('textbox', { name: 'Change to make' }).fill('Add a button');
    await dialog.getByRole('button', { name: 'Propose' }).click();
    await expect(dialog.getByRole('alert')).toHaveText(/used up today’s AI requests/);
    await expect(dialog.getByRole('button', { name: 'Accept' })).toHaveCount(0);
});

test('without AI, Edit with words is not offered', async ({ page }) => {
    await openEditor(page);
    await expect(page.getByRole('navigation', { name: 'Application' })).toBeVisible();
    await expect(editWithWords(page)).toHaveCount(0);
});
