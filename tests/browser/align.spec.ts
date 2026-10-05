import { expect, test } from '@playwright/test';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

test('the inspector aligns and spaces the selection, which its keys do too', async ({ page }) => {
    await openEditor(page, ['Inspector']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 200 }, { x: 460, y: 260 });

    const align = page.getByRole('toolbar', { name: 'Align menu' });
    const space = page.getByRole('toolbar', { name: 'Space menu' });

    // One shape is not enough to align.
    await expect(align).toHaveCount(0);

    await pointer(page, 'pointerdown', { x: 280, y: 80 });
    await pointer(page, 'pointermove', { x: 480, y: 280 });
    await pointer(page, 'pointerup', { x: 480, y: 280 });

    const rects = shapes(page).locator('rect[data-cy]');

    await page.keyboard.press('Shift+A');
    await expect(rects.nth(1)).toHaveAttribute('x', '300');

    await align.getByRole('button', { name: 'Align bottom', exact: true }).click();
    await expect(rects.nth(0)).toHaveAttribute('y', '220');
    await expect(rects.nth(1)).toHaveAttribute('y', '200');

    // Spacing takes three items, and none of these is in the command bar any more.
    await expect(
        space.getByRole('button', { name: 'Space between horizontally', exact: true })
    ).toBeDisabled();
    await expect(
        page
            .getByRole('list', { name: 'Commands' })
            .getByRole('button', { name: /^(Align|Space) /, exact: false })
    ).toHaveCount(0);
});

test('the spacing icons are served', async ({ request }) => {
    const sprite = await request.get('/icons/svg-sprite-reactor-symbol.svg');

    expect(sprite.ok()).toBe(true);
    expect(await sprite.text()).toContain('id="ic_space_between_horizontal_24px"');
});
