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
const prompt = (page: Page) => bar(page).getByRole('textbox', { name: 'Change to make' });
const player = (page: Page) => page.frameLocator('iframe[title="Application preview"]');

async function ask(page: Page, words: string) {
    await prompt(page).fill(words);
    await prompt(page).press('Enter');
}

test('the AI bar on Prototype outlines a proposed link in the player until it is applied', async ({
    page
}) => {
    await seed(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/prototype?ai=local');
    await expect(player(page).getByRole('img', { name: 'Home' })).toBeVisible();
    await expect(bar(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'AI bar' }).click();
    await expect(prompt(page)).toBeFocused();
    await expect(prompt(page)).toHaveAttribute(
        'placeholder',
        'Describe a tap, like “Open Details when I click Continue”'
    );
    await expect(bar(page).getByText('Home', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/prototype-ai-bar-open.png' });

    await ask(page, 'open Details when I click Continue');
    const reply = bar(page).getByRole('log', { name: 'AI conversation' });
    await expect(reply).toContainText('Which “Continue”? Pick one:');
    await expect(reply.getByRole('button', { name: 'Close reply' })).toBeVisible();
    await reply.getByRole('button', { name: /Continue button on Home/ }).click();
    await prompt(page).press('Enter');
    await expect(reply).toContainText('On “Home”, “Continue button” opens “Details”');
    await expect(reply).toContainText('The control is outlined in the player.');
    const continueButton = player(page).locator('button[data-proposed="true"]');
    await expect(continueButton).toHaveAccessibleName('Continue');
    await page.screenshot({ path: 'test-results/prototype-ai-bar-proposal.png' });

    await reply.getByRole('button', { name: 'Apply and try it' }).click();
    await expect(reply).toContainText('Applied 1 change.');
    await expect(continueButton).toHaveCount(0);
    await player(page).getByRole('button', { name: 'Continue' }).first().click();
    await expect(player(page).getByRole('img', { name: 'Details' })).toBeVisible();
    await expect(bar(page).getByText('Details', { exact: true })).toBeVisible();

    await ask(page, 'start on Details');
    await expect(reply).toContainText('Not applied yet.');
    await reply.getByRole('button', { name: 'Discard' }).click();
    await expect(reply).toContainText('Discarded. Nothing changed.');

    await bar(page).getByRole('button', { name: 'Close AI bar' }).click();
    await expect(bar(page)).toHaveCount(0);
    const open = page.getByRole('button', { name: 'AI bar' });
    await expect(open).toBeFocused();
    // With no reply open, Escape closes the bar and focus returns to its button.
    await open.click();
    await expect(prompt(page)).toBeFocused();
    await prompt(page).press('Escape');
    await expect(bar(page)).toHaveCount(0);
    await expect(open).toBeFocused();
});

test('the AI bar is not offered on Prototype without AI', async ({ page }) => {
    await seed(page);
    await page.goto('/prototype');
    await expect(player(page).getByRole('img', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI bar' })).toHaveCount(0);
});
