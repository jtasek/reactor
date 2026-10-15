import { expect, test, type Page } from '@playwright/test';
import { MAX_CONTEXT_BYTES } from '../../src/ai/context';
import { drawRect, openEditor, shapes } from './support/editor';

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

    const chat = page.getByRole('region', { name: 'AI chat', exact: true });
    const prompt = chat.getByRole('textbox', { name: 'Change to make' });

    await expect(prompt).toBeFocused();
    await prompt.fill('Add a sign-in button');
    await prompt.press('Enter');

    const proposal = chat.getByRole('region', { name: 'Proposal' });

    await expect(proposal).toContainText('Add rectangle “Sign in”');
    await expect(proposal).toContainText('I will add a sign-in button.');
    expect(requests).toEqual([
        expect.objectContaining({ task: 'edit', prompt: 'Add a sign-in button' })
    ]);
    await expect(shapes(page)).toHaveCount(0);

    await chat.getByRole('button', { name: 'Accept' }).click();
    await expect(chat).toContainText('Applied. You can undo this change.');
    await expect(shapes(page)).toHaveCount(1);

    await page.locator('svg#surface').click({ position: { x: 500, y: 400 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect(shapes(page)).toHaveCount(0);
});

test('cancelling a proposal under way changes nothing and keeps the words', async ({ page }) => {
    const requests = await signInWithAi(page, () => new Promise<string>(() => {}));

    await openEditor(page);
    await editWithWords(page).click();

    const chat = page.getByRole('region', { name: 'AI chat', exact: true });
    const prompt = chat.getByRole('textbox', { name: 'Change to make' });

    await prompt.fill('Add a sign-in button');
    await chat.getByRole('button', { name: 'Send' }).click();
    await expect(chat).toContainText('Waiting for AI…');

    await chat.getByRole('button', { name: 'Stop' }).click();
    await expect(prompt).toHaveValue('Add a sign-in button');
    await expect(prompt).toBeEditable();
    expect(requests).toHaveLength(1);
    await page.keyboard.press('Escape');
    await expect(chat).toHaveCount(0);
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

    const chat = page.getByRole('region', { name: 'AI chat', exact: true });

    await chat.getByRole('textbox', { name: 'Change to make' }).fill('Add a button');
    await chat.getByRole('button', { name: 'Send' }).click();
    await expect(chat.getByRole('alert')).toHaveText(/used up today’s AI requests/);
    await expect(chat.getByRole('button', { name: 'Accept' })).toHaveCount(0);
});

test('without AI, Edit with words is not offered', async ({ page }) => {
    await openEditor(page);
    await expect(page.getByRole('navigation', { name: 'Application' })).toBeVisible();
    await expect(editWithWords(page)).toHaveCount(0);
});

for (const width of [1280, 390]) {
    test(`sends only selected context and keeps the chat usable at ${width}px`, async ({
        page
    }, testInfo) => {
        await page.setViewportSize({ width, height: 800 });
        const requests = await signInWithAi(page, () =>
            lines(
                { type: 'start', requestId: 'request-1', model: 'example-model' },
                { type: 'operation', operation: SIGN_IN_BUTTON },
                { type: 'done' }
            )
        );

        await openEditor(page);
        await drawRect(page, { x: 100, y: 200 }, { x: 160, y: 250 });
        await drawRect(page, { x: 210, y: 300 }, { x: 270, y: 350 });
        await editWithWords(page).click();

        const chat = page.getByRole('region', { name: 'AI chat', exact: true });

        await expect(chat).toContainText('Using selected items');
        await chat.getByRole('textbox', { name: 'Change to make' }).fill('Add a button below this');
        await page.screenshot({ path: testInfo.outputPath('context.png') });
        await chat.getByRole('button', { name: 'Send' }).click();
        await expect(chat.getByRole('button', { name: 'Accept' })).toBeVisible();

        const { context } = requests[0] as {
            context: { shapes: Record<string, { name: string }>; selection: string[] };
        };

        expect(Object.values(context.shapes).map(({ name }) => name)).toEqual(['rectangle-2']);
        expect(context.selection).toEqual(Object.keys(context.shapes));
        await expect(shapes(page)).toHaveCount(2);
        const box = (await chat.boundingBox())!;

        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        await page.screenshot({ path: testInfo.outputPath('proposal.png') });
        await chat.getByRole('button', { name: 'Discard' }).click();
        await expect(chat.getByRole('textbox', { name: 'Change to make' })).toHaveValue(
            'Add a button below this'
        );
    });
}

test('rejects oversized context locally and keeps the prompt available', async ({ page }) => {
    const requests = await signInWithAi(page, () => '');

    await openEditor(page, ['Variables']);
    await page.getByLabel('New variable name', { exact: true }).fill('Large text');
    await page.getByLabel('New variable type', { exact: true }).selectOption({ label: 'Text' });
    await page
        .getByRole('region', { name: 'Variables' })
        .getByRole('button', { name: 'Add', exact: true })
        .click();
    await page
        .getByLabel('Value of Large text', { exact: true })
        .fill('x'.repeat(MAX_CONTEXT_BYTES));
    await page.getByLabel('Value of Large text', { exact: true }).press('Enter');
    await editWithWords(page).click();
    const chat = page.getByRole('region', { name: 'AI chat', exact: true });
    const prompt = chat.getByRole('textbox', { name: 'Change to make' });

    await expect(chat).toContainText('Using this document');
    await prompt.fill('Add a button');
    await chat.getByRole('button', { name: 'Send' }).click();
    await expect(chat.getByRole('alert')).toContainText(/select fewer items/i);
    expect(requests).toEqual([]);
    await expect(prompt).toBeEditable();
    await expect(prompt).toHaveValue('Add a button');
    await expect(shapes(page)).toHaveCount(0);
});

test('chat stays beside an editable canvas and keeps its conversation when docked', async ({
    page
}) => {
    const requests = await signInWithAi(page, () =>
        lines(
            { type: 'start', requestId: 'request-1', model: 'example-model' },
            { type: 'operation', operation: SIGN_IN_BUTTON },
            { type: 'done' }
        )
    );

    await openEditor(page);
    await editWithWords(page).click();
    const chat = page.getByRole('region', { name: 'AI chat', exact: true });
    const prompt = chat.getByRole('textbox', { name: 'Change to make' });

    await prompt.fill('A draft');
    await prompt.press('ControlOrMeta+a');
    await prompt.press('Delete');
    await expect(prompt).toHaveValue('');
    await drawRect(page, { x: 400, y: 300 }, { x: 450, y: 350 });
    await expect(shapes(page)).toHaveCount(1);
    await prompt.fill('Add a sign-in button');
    await prompt.press('Enter');
    await expect(chat.getByRole('button', { name: 'Accept' })).toBeVisible();

    const header = chat.getByRole('button', { name: /^Move AI chat/ });

    await header.focus();
    await header.press('Shift+ArrowLeft');
    await expect(header).toBeFocused();
    await expect(chat.getByRole('log')).toContainText('Add a sign-in button');
    expect(requests).toHaveLength(1);
    await chat.getByRole('button', { name: 'Accept' }).click();
    await expect(shapes(page)).toHaveCount(2);
    await expect(chat).toContainText('Applied. You can undo this change.');
    await prompt.fill('Add another button');
    await prompt.press('Enter');
    await expect(chat.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(chat.getByRole('log')).toContainText('Add a sign-in button');
    await expect(chat.getByRole('log')).toContainText('Add another button');
    await chat.getByRole('button', { name: 'New chat' }).click();
    await expect(chat.getByRole('log')).not.toContainText('Add another button');
    await expect(chat.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await expect(shapes(page)).toHaveCount(2);
    await chat.getByRole('button', { name: 'Close AI chat' }).click();
    await expect(chat).toHaveCount(0);
    await expect(editWithWords(page)).toBeFocused();
});
