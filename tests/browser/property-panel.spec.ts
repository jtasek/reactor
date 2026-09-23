import { expect, test } from '@playwright/test';
import { drawRect, handles, openEditor, pointer, shapes } from './support/editor';

test('the property panel shows shared and mixed values and edits every selected shape', async ({
    page
}) => {
    await openEditor(page, ['Property Panel']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await drawRect(page, { x: 300, y: 100 }, { x: 350, y: 150 });

    // Select both with a marquee.
    await pointer(page, 'pointerdown', { x: 80, y: 80 });
    await pointer(page, 'pointermove', { x: 380, y: 170 });
    await pointer(page, 'pointerup', { x: 380, y: 170 });

    const x = page.getByLabel('X', { exact: true });

    await expect(x).toHaveValue('');
    await expect(x).toHaveAttribute('placeholder', 'Mixed');
    await expect(page.getByLabel('Y', { exact: true })).toHaveValue('100');
    await expect(page.getByLabel('Width', { exact: true })).toHaveValue('50');

    await x.fill('400');
    await x.press('Enter');

    await expect(shapes(page).locator('rect[data-cy][x="400"]')).toHaveCount(2);
    await expect(x).toHaveValue('400');

    await page.getByLabel('Locked', { exact: true }).check();

    await expect(handles(page)).toHaveCount(0);
});
