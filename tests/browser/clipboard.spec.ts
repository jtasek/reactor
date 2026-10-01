import { expect, test, type Page } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/** Presses the platform's copy, cut or paste keys, as a person would. */
const press = (page: Page, key: 'c' | 'x' | 'v') => page.keyboard.press(`ControlOrMeta+${key}`);

const clipboardText = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

test('copies, cuts and pastes shapes with the keyboard', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 160, y: 140 });

    await press(page, 'c');
    expect(JSON.parse(await clipboardText(page))).toMatchObject({ format: 'reactor/shapes' });

    await press(page, 'v');
    await expect(shapes(page)).toHaveCount(2);
    await expect(shapes(page).nth(1).locator('rect[data-cy]')).toHaveAttribute('x', '110');

    await press(page, 'x');
    await expect(shapes(page)).toHaveCount(1);

    await press(page, 'v');
    await expect(shapes(page)).toHaveCount(2);
});

test('leaves copying and pasting in a text field to the field', async ({ page }) => {
    await openEditor(page, ['Command Line']);
    await drawRect(page, { x: 100, y: 100 }, { x: 160, y: 140 });
    await press(page, 'c');

    const input = page.getByRole('searchbox', { name: 'Command' });

    await input.focus();
    await press(page, 'v');

    await expect(shapes(page)).toHaveCount(1);
    await expect(input).toHaveValue(await clipboardText(page));
});

test('copies the selected shapes after their text was double-clicked or dragged across', async ({
    page
}) => {
    await openEditor(page);
    await page.keyboard.press('t');
    await page.mouse.click(300, 300);
    await page.keyboard.type('Words');
    await page.keyboard.press('Enter');
    await page.keyboard.press('s');
    await page.mouse.click(600, 600);
    await page.mouse.dblclick(310, 295);
    await page.mouse.move(250, 250);
    await page.mouse.down();
    await page.mouse.move(400, 330, { steps: 5 });
    await page.mouse.up();
    await press(page, 'c');

    expect(JSON.parse(await clipboardText(page))).toMatchObject({
        format: 'reactor/shapes',
        shapes: [{ type: 'text', value: 'Words' }]
    });
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

test('leaves the clipboard as it was when nothing is selected', async ({ page }) => {
    await openEditor(page);
    await page.evaluate(() => navigator.clipboard.writeText('kept'));

    const focused = await page.evaluateHandle(() => document.activeElement);

    await press(page, 'c');
    await press(page, 'x');

    expect(await clipboardText(page)).toBe('kept');
    expect(await page.evaluate((element) => document.activeElement === element, focused)).toBe(
        true
    );
});

test('the command bar and the command line copy, cut and paste', async ({ page }) => {
    await openEditor(page, ['Command Line']);

    const copy = page.locator('button[title="Copy selected shapes"]');
    const cut = page.locator('button[title="Cut selected shapes"]');
    const paste = page.locator('button[title="Paste copied shapes"]');
    const input = page.getByRole('searchbox', { name: 'Command' });

    await expect(copy).toBeDisabled();
    await drawRect(page, { x: 100, y: 100 }, { x: 160, y: 140 });

    await copy.click();
    await expect.poll(() => clipboardText(page)).toContain('reactor/shapes');
    await paste.click();
    await expect(shapes(page)).toHaveCount(2);

    await cut.click();
    await expect(shapes(page)).toHaveCount(1);

    await input.fill('paste');
    await input.press('Enter');
    await expect(shapes(page)).toHaveCount(2);
});
