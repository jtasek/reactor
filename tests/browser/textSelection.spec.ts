import { expect, test, type Page } from '@playwright/test';
import { openEditor, shapes } from './support/editor';

/** Longer than the time within which changes undo as one. */
const APART_MS = 600;

const text = (page: Page) => shapes(page).locator('text[data-cy]');
const selection = (page: Page) => page.locator('svg#surface #shapes [data-handle]');
const field = (page: Page) => page.locator('svg#surface foreignObject input[aria-label="Text"]');

/** Opens the editor and types `words` at (300, 300), committed with Enter. */
async function addText(page: Page, words: string) {
    await openEditor(page);
    const box = (await page.locator('svg#surface').boundingBox())!;
    const at = (x: number, y: number) => [box.x + x, box.y + y] as const;

    await page.keyboard.press('t');
    await page.mouse.click(...at(300, 300));
    await page.keyboard.type(words);
    await page.keyboard.press('Enter');

    return at;
}

test('new text is selected, and a click selects it again', async ({ page }) => {
    const at = await addText(page, 'Words');

    await expect(text(page)).toHaveText('Words');
    await expect(selection(page)).not.toHaveCount(0);

    await page.mouse.click(...at(600, 500));
    await expect(selection(page)).toHaveCount(0);

    await page.mouse.click(...at(310, 295));
    await expect(selection(page)).not.toHaveCount(0);
    await expect(shapes(page)).toHaveCount(1);
});

test('a double click changes the words; Enter or clicking away keeps them', async ({ page }) => {
    const at = await addText(page, 'Words');

    await page.mouse.dblclick(...at(310, 295));
    await expect(field(page)).toBeFocused();
    await expect(field(page)).toHaveValue('Words');

    await page.keyboard.type('Other');
    await page.keyboard.press('Enter');
    await expect(field(page)).toHaveCount(0);
    await expect(text(page)).toHaveText('Other');
    await expect(shapes(page)).toHaveCount(1);
    await expect(selection(page)).not.toHaveCount(0);

    // Apart enough to undo as a step of its own.
    await page.waitForTimeout(APART_MS);
    await page.mouse.dblclick(...at(310, 295));
    await page.keyboard.type('Third');
    await page.mouse.click(...at(600, 500));
    await expect(field(page)).toHaveCount(0);
    await expect(text(page)).toHaveText('Third');

    await page.keyboard.press('ControlOrMeta+z');
    await expect(text(page)).toHaveText('Other');
});

test('Escape leaves the words as they were', async ({ page }) => {
    const at = await addText(page, 'Words');

    await page.mouse.dblclick(...at(310, 295));
    await page.keyboard.type('Other');
    await page.keyboard.press('Escape');

    await expect(field(page)).toHaveCount(0);
    await expect(text(page)).toHaveText('Words');
});
