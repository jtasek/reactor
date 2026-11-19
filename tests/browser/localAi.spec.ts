import { expect, test, type Page } from '@playwright/test';
import { shapes } from './support/editor';

const editWithWords = (page: Page) =>
    page.getByRole('navigation', { name: 'Application' }).getByRole('button', {
        name: 'Edit with words'
    });

async function ask(page: Page, words: string) {
    const prompt = page.getByRole('textbox', { name: 'Change to make' });

    await prompt.fill(words);
    await prompt.press('Enter');
}

test('the chat is not offered signed out without ?ai=local', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(editWithWords(page)).toHaveCount(0);
});

test('?ai=local answers the chat in the browser, with no request to the server', async ({
    page
}) => {
    const sent: string[] = [];

    page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/ai')) {
            sent.push(request.url());
        }
    });
    await page.goto('/?ai=local');
    await editWithWords(page).click();

    const chat = page.getByRole('group', { name: 'Chat controls' });

    await expect(chat).toContainText('Local test model');
    await ask(page, 'add 2 red circles');
    await chat.getByRole('button', { name: 'Accept' }).click();
    await expect(shapes(page)).toHaveCount(2);

    await ask(page, '/repair add a rectangle');
    await chat.getByRole('button', { name: 'Accept' }).click();
    await expect(shapes(page)).toHaveCount(3);

    await ask(page, '/fail limit');
    await expect(chat.getByRole('alert')).toContainText('used up today’s AI requests');

    // Words only are shown once, as the answer, not again as a problem.
    await ask(page, '/words Hello there');
    // The words come back to the composer once the answer has ended.
    await expect(page.getByRole('textbox', { name: 'Change to make' })).toHaveValue(
        '/words Hello there'
    );
    await expect(chat.getByText('Hello there', { exact: true })).toHaveCount(1);

    // The choice lasts for the tab, until the address asks for the server again.
    await page.goto('/');
    await expect(editWithWords(page)).toBeVisible();
    await page.goto('/?ai=server');
    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(editWithWords(page)).toHaveCount(0);
    expect(sent).toEqual([]);
});

test('the selection offers the AI bar, which shares its chat with the panel', async ({ page }) => {
    await page.goto('/?ai=local');
    await editWithWords(page).click();
    await ask(page, 'add a red rectangle');

    const chat = page.getByRole('group', { name: 'Chat controls' });

    await chat.getByRole('button', { name: 'Accept' }).click();
    await page.getByRole('button', { name: 'Close AI chat' }).click();

    const askAi = page.getByRole('button', { name: 'Ask AI about the selection' });

    await expect(askAi).toHaveCount(0);
    await page.getByRole('button', { name: 'rectangle-1' }).first().click();
    // Bring the drawing out from under the Explorer, where the button can be pressed.
    await page.mouse.move(640, 400);
    await page.mouse.wheel(-420, -260);
    await askAi.click();

    const bar = page.getByRole('region', { name: 'AI bar' });

    await expect(bar.getByRole('textbox', { name: 'Change to make' })).toBeFocused();
    await expect(bar).toContainText('rectangle-1');
    // The button hides while the chat is open.
    await expect(askAi).toHaveCount(0);
    await ask(page, 'make it green');
    await bar.getByRole('button', { name: 'Accept' }).click();
    await expect(bar).toContainText('Applied 1 change.');

    await bar.getByRole('button', { name: 'Open in chat panel' }).click();
    await expect(bar).toHaveCount(0);
    // The panel carries on the bar's conversation; closing the panel earlier ended the first one.
    await expect(page.getByRole('log', { name: 'AI conversation' })).toContainText('make it green');

    await page.getByRole('button', { name: 'Close AI chat' }).click();
    await askAi.click();
    await page.keyboard.press('Escape');
    await expect(bar).toHaveCount(0);
    await expect(askAi).toBeVisible();
});

test('help gives examples by kind, the full list on request, and Tab finishes a sentence', async ({
    page
}) => {
    await page.goto('/?ai=local');
    await editWithWords(page).click();

    const chat = page.getByRole('group', { name: 'Chat controls' });
    const prompt = page.getByRole('textbox', { name: 'Change to make' });
    const applied = chat.getByText(/^Applied/);

    // Clear of the panels over the canvas, where it can be clicked.
    for (const [index, words] of [
        'add a 160x48 rectangle named "Card"',
        'move all rectangles right 400',
        'move all rectangles down 300'
    ].entries()) {
        await ask(page, words);
        await chat.getByRole('button', { name: 'Accept' }).click();
        await expect(applied).toHaveCount(index + 1);
    }
    await shapes(page).first().click();
    await ask(page, 'help');
    await expect(chat.getByRole('term')).toHaveText(['Add', 'ChangeCard', 'Arrange']);
    await expect(chat.getByRole('definition').nth(1)).toContainText('now 0');
    await expect(chat.getByRole('definition').nth(2)).not.toContainText('help all');
    await expect(prompt).toHaveValue('help');
    await chat.getByRole('button', { name: 'corner radius 12' }).click();
    await expect(prompt).toHaveValue('corner radius 12');
    await expect(prompt).toBeFocused();

    await prompt.fill('make it wi');
    await expect(chat.getByText('Tab to complete')).toBeVisible();
    await expect(prompt).toHaveAccessibleDescription(/^Tab to complete ?: make it wider by 40$/);
    await prompt.press('Tab');
    await expect(prompt).toHaveValue('make it wider by 40');
    await expect(prompt).toBeFocused();
    await prompt.press('Enter');
    await chat.getByRole('button', { name: 'Accept' }).click();
    await expect(applied).toHaveCount(4);

    await ask(page, 'help all');
    await expect(chat.getByRole('heading', { name: 'Everything I understand' })).toBeVisible();
    await expect(chat).toContainText('font weight');
    await expect(prompt).toHaveValue('help all');
});
