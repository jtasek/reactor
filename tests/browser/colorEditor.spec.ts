import { expect, test } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

// The editor opens without its scale-in, so its box is where the pointer is aimed.
test.use({ reducedMotion: 'reduce' });

test('a color field opens the color editor, which edits by hex, RGB and keys', async ({ page }) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const fill = page.getByLabel('Fill', { exact: true });
    const rect = shapes(page).first().locator('rect[data-cy]');
    const shown = () => rect.evaluate((element) => getComputedStyle(element).fill);
    const editor = page.getByRole('dialog', { name: 'Fill color' });

    await fill.fill('#3366cc');
    await fill.click();
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('Hex')).toHaveValue('3366CC');
    await expect(editor.getByLabel('Red')).toHaveValue('51');

    await editor.getByLabel('Hex').fill('ff8800');
    await editor.getByLabel('Hex').press('Enter');
    await expect.poll(shown).toBe('rgb(255, 136, 0)');
    await expect(fill).toHaveValue('#ff8800');

    await editor.getByLabel('Blue').fill('255');
    await editor.getByLabel('Blue').press('Enter');
    await expect.poll(shown).toBe('rgb(255, 136, 255)');

    // Brightness down by ten steps, from the keyboard.
    const area = editor.getByRole('slider', { name: 'Saturation and brightness' });
    await area.focus();
    await page.keyboard.press('Shift+ArrowDown');
    await expect(area).toHaveAttribute('aria-valuetext', /brightness 90%/);
    await expect(fill).not.toHaveValue('#ff88ff');

    // Escape closes the editor and gives the field its focus back, keeping the shape.
    await page.keyboard.press('Escape');
    await expect(editor).toBeHidden();
    await expect(fill).toBeFocused();
    await expect(shapes(page)).toHaveCount(1);

    // The close button closes it too; Enter on the field opens it again.
    await page.keyboard.press('Enter');
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: 'Close' }).click();
    await expect(editor).toBeHidden();
});

test('dragging across the color editor picks saturation, brightness and hue', async ({ page }) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const fill = page.getByLabel('Fill', { exact: true });
    await fill.fill('#ff0000');
    await fill.click();

    const editor = page.getByRole('dialog', { name: 'Fill color' });
    const area = (await editor
        .getByRole('slider', { name: 'Saturation and brightness' })
        .boundingBox())!;

    const center = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
    const drag = async (x: number, y: number) => {
        await page.mouse.move(center.x, center.y);
        await page.mouse.down();
        await page.mouse.move(x, y, { steps: 4 });
        await page.mouse.up();
    };

    // A drag keeps going past the edges: bottom left is black, top right the hue at full strength.
    await drag(area.x - 20, area.y + area.height + 20);
    await expect(fill).toHaveValue('#000000');
    await drag(area.x + area.width + 20, area.y - 20);
    await expect(fill).toHaveValue('#ff0000');

    const hue = (await editor.getByRole('slider', { name: 'Hue' }).boundingBox())!;
    await page.mouse.click(hue.x + hue.width / 3, hue.y + hue.height / 2);
    await expect(fill).toHaveValue(/^#0[0-9]f[c-f]0[0-9]$/);
});
