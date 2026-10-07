import { expect, test } from '@playwright/test';
import { openEditor, pointer, shapes } from './support/editor';

/** A 1 by 1 PNG. */
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

test('the image tool asks for a file, draws it, and shows it again after a reload', async ({
    page
}) => {
    await openEditor(page);

    const chooser = page.waitForEvent('filechooser');

    await page.keyboard.press('i');
    await (await chooser).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
    // The file is read and kept before it can be drawn.
    await page.waitForTimeout(300);

    await pointer(page, 'pointerdown', { x: 100, y: 100 });
    await pointer(page, 'pointermove', { x: 160, y: 130 });
    await pointer(page, 'pointerup', { x: 160, y: 130 });

    const image = shapes(page).locator('image');

    // The picture is square, so the box takes the longer side of the drag.
    await expect(image).toHaveAttribute('width', '60');
    await expect(image).toHaveAttribute('height', '60');
    await expect(image).toHaveAttribute('href', /^blob:/);
    await expect(page.locator('#status-save')).toHaveText('Saved');

    await page.reload();
    await expect(shapes(page).locator('image')).toHaveAttribute('href', /^blob:/);
});
