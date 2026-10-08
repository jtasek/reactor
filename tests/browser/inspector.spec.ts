import { expect, test, type Page } from '@playwright/test';
import { drawRect, handles, openEditor, pointer, selectTool, shapes } from './support/editor';

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const section = (page: Page, name: string) => page.getByRole('columnheader', { name, exact: true });
const rectAttribute = (page: Page, name: string, attribute: string) =>
    page.locator(`svg#surface rect[data-cy="${name}"]`).getAttribute(attribute);

/** Clicks the canvas with the real mouse, which also moves focus like a user would. */
async function click(page: Page, x: number, y: number) {
    const box = (await page.locator('svg#surface').boundingBox())!;

    await page.mouse.click(box.x + x, box.y + y);
}

async function twoRects(page: Page) {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await drawRect(page, { x: 300, y: 100 }, { x: 350, y: 150 });

    return page
        .locator('svg#surface rect[data-cy]')
        .evaluateAll((rects) => rects.map((rect) => rect.getAttribute('data-cy')!));
}

test('the inspector shows shared and mixed values and edits every selected shape', async ({
    page
}) => {
    await twoRects(page);

    // Select both with a marquee.
    await pointer(page, 'pointerdown', { x: 80, y: 80 });
    await pointer(page, 'pointermove', { x: 380, y: 170 });
    await pointer(page, 'pointerup', { x: 380, y: 170 });

    await expect(section(page, 'Shape')).toBeVisible();
    await expect(section(page, 'Text')).toHaveCount(0);
    await expect(field(page, 'X')).toHaveValue('');
    await expect(field(page, 'X')).toHaveAttribute('placeholder', 'Mixed');
    await expect(field(page, 'Y')).toHaveValue('100');
    await expect(field(page, 'Width')).toHaveValue('50');

    await field(page, 'X').fill('400');
    await field(page, 'X').press('Enter');

    await expect(shapes(page).locator('rect[data-cy][x="400"]')).toHaveCount(2);

    // The panel follows changes made on the canvas, too.
    await pointer(page, 'pointerdown', { x: 420, y: 120 });
    await pointer(page, 'pointermove', { x: 430, y: 120 });
    await pointer(page, 'pointerup', { x: 430, y: 120 });

    await expect(field(page, 'X')).toHaveValue('410');

    await field(page, 'Locked').check();

    await expect(handles(page)).toHaveCount(0);
    await expect(field(page, 'X')).toHaveAttribute('readonly', '');
});

test('an edit applies to the shapes it was typed for, even after clicking another shape', async ({
    page
}) => {
    const [first, second] = await twoRects(page);

    await click(page, 600, 500); // empty canvas: nothing selected
    await click(page, 120, 120); // select the first rectangle only
    await field(page, 'Y').fill('250');
    await click(page, 320, 120); // select the second before pressing Enter

    await expect.poll(() => rectAttribute(page, first, 'y')).toBe('250');
    await expect.poll(() => rectAttribute(page, second, 'y')).toBe('100');
    await expect(field(page, 'Y')).toHaveValue('100');
});

test('Enter keeps focus, and a rejected edit shows the actual value again', async ({ page }) => {
    const [first] = await twoRects(page);

    await click(page, 600, 500);
    await click(page, 120, 120);

    const x = field(page, 'X');
    const name = field(page, 'Name');

    await x.fill('160');
    await x.press('Enter');

    await expect.poll(() => rectAttribute(page, first, 'x')).toBe('160');
    await expect(x).toBeFocused();

    await name.fill('');
    await name.press('Enter');

    await expect(name).toHaveValue(first);
    await expect(name).toBeFocused();

    // Enter that confirms an input method composition does not apply the edit.
    await x.fill('500');
    await x.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });

    await expect.poll(() => rectAttribute(page, first, 'x')).toBe('160');
    await expect(x).toHaveValue('500');
});

test('an edit is applied even when selecting another shape removes its field', async ({ page }) => {
    await twoRects(page);

    // Type a text shape at (100, 300).
    await selectTool(page, 'Type a text');
    await pointer(page, 'pointerdown', { x: 100, y: 300 });
    await pointer(page, 'pointerup', { x: 100, y: 300 });
    await page.keyboard.type('hello');
    await page.keyboard.press('Enter');

    await click(page, 600, 500);
    await click(page, 110, 295);
    await expect(section(page, 'Text')).toBeVisible();
    await field(page, 'Text').fill('changed');

    // Selecting a rectangle removes the Text field before it would lose focus.
    await click(page, 320, 120);

    await expect(field(page, 'Text')).toHaveCount(0);
    await expect(page.locator('svg#surface text[data-cy]')).toHaveText('changed');
});

test('the inspector holds its values during a gesture and shows the new ones on release', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await expect(field(page, 'X')).toHaveValue('100');

    await pointer(page, 'pointerdown', { x: 125, y: 125 });
    await pointer(page, 'pointermove', { x: 165, y: 125 });
    await expect(field(page, 'X')).toHaveValue('100');
    await pointer(page, 'pointerup', { x: 165, y: 125 });
    await expect(field(page, 'X')).toHaveValue('140');

    // A click on empty canvas clears the selection, then a marquee boxes the shape.
    await pointer(page, 'pointerdown', { x: 400, y: 400 });
    await pointer(page, 'pointerup', { x: 400, y: 400 });
    await expect(section(page, 'Shape')).toHaveCount(0);

    await pointer(page, 'pointerdown', { x: 120, y: 80 });
    await pointer(page, 'pointermove', { x: 220, y: 170 });
    await expect(section(page, 'Shape')).toHaveCount(0);
    await pointer(page, 'pointerup', { x: 220, y: 170 });
    await expect(field(page, 'X')).toHaveValue('140');
});

test('opacity is set by its field or its slider and draws the shape see-through', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const drawn = shapes(page).first().locator('> g').first();
    const number = page.getByRole('spinbutton', { name: 'Opacity (%)' });
    const slider = page.getByRole('slider', { name: 'Opacity (%)' });

    await expect(number).toHaveValue('100');
    await expect(slider).toHaveValue('100');

    await number.fill('40');
    await number.press('Enter');
    await expect(drawn).toHaveAttribute('opacity', '0.4');
    await expect(slider).toHaveValue('40');

    await slider.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(drawn).toHaveAttribute('opacity', '0.39');
    await expect(number).toHaveValue('39');
});

test('the opacity slider is hidden for mixed values and disabled on a locked shape', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const number = page.getByRole('spinbutton', { name: 'Opacity (%)' });
    const slider = page.getByRole('slider', { name: 'Opacity (%)' });

    await number.fill('40');
    await number.press('Enter');
    await drawRect(page, { x: 300, y: 100 }, { x: 350, y: 150 });

    // Both with a marquee: their opacities differ.
    await pointer(page, 'pointerdown', { x: 80, y: 80 });
    await pointer(page, 'pointermove', { x: 380, y: 170 });
    await pointer(page, 'pointerup', { x: 380, y: 170 });
    await expect(number).toHaveAttribute('placeholder', 'Mixed');
    await expect(slider).toHaveCount(0);

    // The second alone, then locked.
    await click(page, 600, 500);
    await click(page, 325, 125);
    await field(page, 'Locked').check();
    await expect(slider).toBeDisabled();
});

test('fill is picked as a color, drawn inside the shape, and taken off by None', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const rect = shapes(page).first().locator('rect[data-cy]');
    const fill = () => rect.evaluate((element) => getComputedStyle(element).fill);
    const none = page.getByRole('button', { name: 'No fill', exact: true });

    await expect.poll(fill).toBe('none');
    await expect(none).toHaveAttribute('aria-pressed', 'true');

    await field(page, 'Fill').fill('#ff8800');
    await expect.poll(fill).toBe('rgb(255, 136, 0)');
    await expect(none).toHaveAttribute('aria-pressed', 'false');

    await none.click();
    await expect.poll(fill).toBe('none');
});

test('a color field is disabled on a locked shape and marks no color and mixed colors', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const noColor = (label: string) =>
        field(page, label).evaluate((input) => input.matches('[data-no-color]'));

    expect(await noColor('Fill')).toBe(true);
    await field(page, 'Fill').fill('#ff8800');
    expect(await noColor('Fill')).toBe(false);
    await drawRect(page, { x: 300, y: 100 }, { x: 350, y: 150 });

    // Both with a marquee: one is filled, the other not.
    await pointer(page, 'pointerdown', { x: 80, y: 80 });
    await pointer(page, 'pointermove', { x: 380, y: 170 });
    await pointer(page, 'pointerup', { x: 380, y: 170 });
    await expect(page.getByText('Mixed', { exact: true })).toBeVisible();
    expect(await noColor('Fill')).toBe(true);

    // The second alone, then locked.
    await click(page, 600, 500);
    await click(page, 325, 125);
    await field(page, 'Locked').check();
    await expect(field(page, 'Fill')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'No fill', exact: true })).toBeDisabled();
});
