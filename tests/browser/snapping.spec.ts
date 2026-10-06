import { expect, test } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

test('a dragged shape snaps to another one, showing the line, unless Ctrl or Cmd is held', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });
    await drawRect(page, { x: 300, y: 300 }, { x: 340, y: 340 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const at = (x: number, y: number) => [surface.x + x, surface.y + y] as const;
    const first = shapes(page).locator('rect[data-cy]').first();
    const snapLines = page.locator('svg#surface g[class] > path');

    // Its left edge would end at 297, three short of the other's at 300.
    await page.mouse.move(...at(120, 120));
    await page.mouse.down();
    await page.mouse.move(...at(317, 200), { steps: 8 });
    await expect(snapLines.first()).toBeVisible();
    await page.mouse.up();

    await expect(first).toHaveAttribute('x', '300');
    await expect(snapLines).toHaveCount(0);

    // Held Ctrl or Cmd, the same drag lands where the pointer puts it.
    await page.mouse.move(...at(320, 200));
    await page.keyboard.down('ControlOrMeta');
    await page.mouse.down();
    await page.mouse.move(...at(117, 200), { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('ControlOrMeta');

    await expect(first).toHaveAttribute('x', '97');
});
