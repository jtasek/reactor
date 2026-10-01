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
