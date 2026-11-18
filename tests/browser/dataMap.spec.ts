import { expect, test } from '@playwright/test';
import { openEditor } from './support/editor';

test('drags an entity on the data map, keeps its place after reload, zooms and lays out again', async ({
    page
}) => {
    await openEditor(page, ['Data']);
    const panel = page.getByRole('region', { name: 'Data', exact: true });
    for (const name of ['Companies', 'Customers']) {
        await panel.getByRole('textbox', { name: 'New entity', exact: true }).fill(name);
        await panel.getByRole('button', { name: 'Add entity', exact: true }).click();
    }
    const map = panel.getByRole('group', { name: 'Data model map' });
    const header = map.getByRole('button', { name: 'Show Customers', exact: true });
    const card = header.locator('..');
    const before = await card.evaluate((element) => (element as HTMLElement).style.left);

    const box = (await header.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + box.height / 2 + 30, { steps: 5 });
    await page.mouse.up();
    await expect
        .poll(() => card.evaluate((element) => (element as HTMLElement).style.left))
        .not.toBe(before);
    const moved = await card.evaluate((element) => (element as HTMLElement).style.left);
    await expect(panel.getByRole('button', { name: 'Auto layout', exact: true })).toBeVisible();

    await header.focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect
        .poll(() => card.evaluate((element) => parseFloat((element as HTMLElement).style.left)))
        .toBe(parseFloat(moved) + 16);

    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await openEditor(page, ['Data']);
    await expect
        .poll(() => card.evaluate((element) => parseFloat((element as HTMLElement).style.left)))
        .toBe(parseFloat(moved) + 16);

    const zoom = panel.getByRole('group', { name: 'Map zoom' });
    await zoom.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect(zoom.getByRole('button', { name: 'Actual size' })).toHaveText('90%');
    await zoom.getByRole('button', { name: 'Actual size' }).click();
    await expect(zoom.getByRole('button', { name: 'Actual size' })).toHaveText('100%');

    await panel.getByRole('button', { name: 'Auto layout', exact: true }).click();
    await expect
        .poll(() => card.evaluate((element) => (element as HTMLElement).style.left))
        .toBe(before);
    await expect(panel.getByRole('button', { name: 'Auto layout', exact: true })).toHaveCount(0);
});
