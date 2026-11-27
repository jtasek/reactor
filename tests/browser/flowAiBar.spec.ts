import { expect, test, type Page } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { prototypeDocument } from '../support/prototype';

async function seed(page: Page) {
    const document = prototypeDocument();
    for (const shape of Object.values(document.shapes)) {
        if (shape.type === 'instance' && shape.name !== 'Name field') {
            shape.interactions = { activate: null };
            delete shape.interaction;
        }
    }
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
}

const bar = (page: Page) => page.getByRole('region', { name: 'AI bar' });

async function ask(page: Page, words: string) {
    const prompt = bar(page).getByRole('textbox', { name: 'Change to make' });

    await prompt.fill(words);
    await prompt.press('Enter');
}

test('the AI bar on Flow proposes a link, drawn dashed until Accept', async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/flow?ai=local');
    await expect(page.getByText('Flow · 2 screens · 0 links')).toBeVisible();
    await expect(bar(page).getByRole('textbox', { name: 'Change to make' })).toHaveAttribute(
        'placeholder',
        'Describe a link, like “Open Details when I click Continue”'
    );
    await page.screenshot({ path: 'test-results/flow-ai-bar-resting.png' });

    await ask(page, 'open Details when I click Continue');
    const reply = bar(page).getByRole('log', { name: 'AI conversation' });
    await expect(reply).toContainText('Which “Continue”? Pick one:');
    // The answer has finished once its reply can be closed.
    await expect(reply.getByRole('button', { name: 'Close reply' })).toBeVisible();
    await page.screenshot({ path: 'test-results/flow-ai-bar-which.png' });
    await reply.getByRole('button', { name: /Continue button on Home/ }).click();
    await bar(page).getByRole('textbox', { name: 'Change to make' }).press('Enter');

    await expect(reply).toContainText('On “Home”, “Continue button” opens “Details”');
    const row = page.locator('[data-flow-control="next"]');
    await expect(row).toHaveAttribute('data-proposed', 'true');
    await expect(page.locator('[data-flow-link="next"]')).toHaveAttribute('data-proposed', 'true');
    await page.screenshot({ path: 'test-results/flow-ai-bar-proposal.png' });

    await reply.getByRole('button', { name: 'Accept' }).click();
    await expect(reply).toContainText('Applied 1 change.');
    await expect(row).not.toHaveAttribute('data-proposed');
    await expect(page.getByText('Flow · 2 screens · 1 link')).toBeVisible();

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Flow · 2 screens · 0 links')).toBeVisible();

    await ask(page, 'start on Details');
    await expect(page.locator('[data-flow-screen="details"]')).toHaveAttribute(
        'data-proposed',
        'true'
    );
    await reply.getByRole('button', { name: 'Discard' }).click();
    await expect(reply).toContainText('Discarded. Nothing changed.');
    await bar(page).getByRole('textbox', { name: 'Change to make' }).press('Escape');
    await expect(reply).toHaveCount(0);
});

test('the AI bar is not offered on Flow without AI', async ({ page }) => {
    await seed(page);
    await page.goto('/flow');
    await expect(page.getByText('Flow · 2 screens · 0 links')).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
});
