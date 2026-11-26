import { expect, test } from '@playwright/test';
import { openEditor, pointer, shapes } from './support/editor';

test('Shift snaps a line to 45°, and Shift+L draws an arrow', async ({ page }) => {
    await openEditor(page);

    await page.keyboard.press('l');
    await pointer(page, 'pointerdown', { x: 300, y: 300 });
    await page.keyboard.down('Shift');
    await pointer(page, 'pointermove', { x: 400, y: 310 });
    await pointer(page, 'pointerup', { x: 400, y: 310 });
    await page.keyboard.up('Shift');

    const line = shapes(page).first().locator('line[data-cy]');
    await expect(line).toHaveAttribute('y2', (await line.getAttribute('y1')) ?? '');
    await expect(shapes(page).first().locator('polyline')).toHaveCount(0);

    await page.keyboard.press('Shift+L');
    await expect(
        page.getByRole('list', { name: 'Tools' }).getByRole('button', { pressed: true })
    ).toHaveAttribute('title', 'Draw an arrow');
    await pointer(page, 'pointerdown', { x: 300, y: 400 });
    await pointer(page, 'pointermove', { x: 400, y: 450 });
    await pointer(page, 'pointerup', { x: 400, y: 450 });

    await expect(shapes(page)).toHaveCount(2);
    await expect(shapes(page).last().locator('polyline')).toHaveCount(1);
});

test('the Inspector adds or removes a line’s arrowhead', async ({ page }) => {
    await openEditor(page, ['Inspector']);
    await page.keyboard.press('l');
    await pointer(page, 'pointerdown', { x: 300, y: 300 });
    await pointer(page, 'pointermove', { x: 400, y: 350 });
    await pointer(page, 'pointerup', { x: 400, y: 350 });

    const head = shapes(page).first().locator('polyline');
    await expect(head).toHaveCount(0);
    await page.getByRole('button', { name: 'Arrowhead', exact: true }).click();
    await expect(head).toHaveCount(1);
    await page.getByRole('button', { name: 'No arrowhead', exact: true }).click();
    await expect(head).toHaveCount(0);
});
