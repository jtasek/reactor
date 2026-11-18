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
