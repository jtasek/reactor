import { expect, test, type Page } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

/** Longer than the time within which a copy's changes undo as one. */
const APART_MS = 600;

const commandButton = (page: Page, name: string) =>
    page.getByRole('list', { name: 'Commands' }).getByRole('button', { name, exact: true });

test('undoes and redoes a drawing from the keyboard and the command bar', async ({ page }) => {
    await openEditor(page);
    const undo = commandButton(page, 'Undo');
    const redo = commandButton(page, 'Redo');

    await expect(undo).toBeDisabled();
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await expect(shapes(page)).toHaveCount(1);
    await expect(undo).toBeEnabled();
    await expect(redo).toBeDisabled();

    await page.keyboard.press('ControlOrMeta+z');
    await expect(shapes(page)).toHaveCount(0);
    await expect(redo).toBeEnabled();

    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(shapes(page)).toHaveCount(1);

    await undo.click();
    await expect(shapes(page)).toHaveCount(0);
    await redo.click();
    await expect(shapes(page)).toHaveCount(1);
});

test('saves what undo changes, and starts with nothing to undo', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await page.waitForTimeout(APART_MS);
    await drawRect(page, { x: 200, y: 100 }, { x: 250, y: 150 });
    await expect(shapes(page)).toHaveCount(2);

    await page.keyboard.press('ControlOrMeta+z');
    await expect(shapes(page)).toHaveCount(1);
    await expect(page.locator('#status-save')).toHaveText('Saved');

    await page.reload();
    await expect(shapes(page)).toHaveCount(1);
    await expect(commandButton(page, 'Undo')).toBeDisabled();
    await expect(commandButton(page, 'Redo')).toBeDisabled();
});

test('undoes only this tab’s change, in every tab', async ({ page, context }) => {
    await openEditor(page);
    const other = await context.newPage();

    await openEditor(other);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await expect(shapes(other)).toHaveCount(1);
    await drawRect(other, { x: 200, y: 100 }, { x: 250, y: 150 });
    await expect(shapes(page)).toHaveCount(2);

    await page.keyboard.press('ControlOrMeta+z');

    for (const tab of [page, other]) {
        await expect(shapes(tab)).toHaveCount(1);
        await expect(shapes(tab).locator('rect[data-cy]')).toHaveAttribute('x', '200');
    }
    await expect(commandButton(other, 'Undo')).toBeEnabled();
});
