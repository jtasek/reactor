import { expect, test } from '@playwright/test';
import { openEditor } from './support/editor';

test('edits guide orientation and one coordinate, with cancel, locking and dragging', async ({
    page
}) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openEditor(page, ['Inspector', 'Rulers', 'Guides']);
    await page.getByRole('checkbox', { name: 'Tool Bar', exact: true }).uncheck();
    await page.getByRole('button', { name: 'More panels' }).click();
    await expect(page.locator('svg#surface [data-ruler]')).toHaveCount(2);
    await page.mouse.move(10, 300);
    await page.mouse.down();
    await page.mouse.move(400, 300, { steps: 6 });
    await page.mouse.up();
    const line = page.locator('svg#surface #guides > line');
    await expect(line).toHaveAttribute('x1', '400');
    await page.mouse.click(400, 550);
    const x = page.getByRole('spinbutton', { name: 'Guide X', exact: true });
    const y = page.getByRole('spinbutton', { name: 'Guide Y', exact: true });
    await expect(x).toHaveValue('400');
    await expect(y).toHaveCount(0);
    await x.fill('-12.5');
    await x.press('Enter');
    await expect(x).toHaveValue('-12.5');
    await expect(line).toHaveAttribute('x1', '-12.5');
    await x.fill('250');
    await x.press('Escape');
    await expect(x).toHaveValue('-12.5');
    await x.fill('300.5');
    await x.press('Tab');
    await page.getByLabel('Guide orientation').selectOption('horizontal');
    await expect(x).toHaveCount(0);
    await expect(y).toHaveValue('300.5');
    await expect(line).toHaveAttribute('y1', '300.5');
    await page.getByRole('button', { name: 'Lock guide', exact: true }).click();
    await expect(y).toBeDisabled();
    await page.mouse.click(600, 500);
    await page.mouse.move(600, 500);
    await page.mouse.down();
    await page.mouse.move(650, 550, { steps: 6 });
    await expect(line).toHaveAttribute('data-selected', 'false');
    await page.locator('svg#surface line[style*="cursor: default"]').dispatchEvent('pointerdown', {
        pointerId: 2,
        pointerType: 'touch',
        button: 0,
        buttons: 1,
        clientX: 600,
        clientY: 300.5
    });
    await expect(line).toHaveAttribute('data-selected', 'false');
    await page.mouse.up();
    await page.mouse.click(600, 300.5);
    await expect(y).toBeDisabled();
    await page.getByRole('button', { name: 'Unlock guide', exact: true }).click();
    await page.mouse.move(600, 300.5);
    await page.mouse.down();
    await page.mouse.move(600, 350, { steps: 6 });
    await expect(y).toBeDisabled();
    await page.mouse.up();
    await expect(y).toHaveValue('350');
    await page.screenshot({ path: 'test-results/guide-inspector-wide.png' });
    await page.setViewportSize({ width: 600, height: 800 });
    await expect(y).toBeVisible();
    await page.screenshot({ path: 'test-results/guide-inspector-narrow.png' });
});
