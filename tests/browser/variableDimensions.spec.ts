import { expect, test } from '@playwright/test';
import { drawRect, openEditor, shapes, pointer } from './support/editor';

test('Light/Dark paints locally, preserves bounds and hit testing, and survives reload', async ({
    page
}) => {
    await openEditor(page, ['Inspector', 'Variables']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await page.getByLabel('New variable name', { exact: true }).fill('Ink');
    await page
        .getByRole('region', { name: 'Variables' })
        .getByRole('button', { name: 'Add', exact: true })
        .click();
    await page.getByLabel('Value of Ink', { exact: true }).fill('#112233');
    await page.getByLabel('Variable for Fill', { exact: true }).selectOption({ label: 'Ink' });
    const rect = shapes(page).first().locator('rect[data-cy]');
    const fill = () => rect.evaluate((element) => getComputedStyle(element).fill);
    await expect.poll(fill).toBe('rgb(17, 34, 51)');
    const bounds = await rect.boundingBox();
    await page.getByLabel('Dark value of Ink', { exact: true }).fill('#ddeeff');
    await expect.poll(fill).toBe('rgb(17, 34, 51)');
    await page.getByLabel('Preview theme', { exact: true }).selectOption('dark');
    await expect.poll(fill).toBe('rgb(221, 238, 255)');
    expect(await rect.boundingBox()).toEqual(bounds);
    await expect
        .poll(() =>
            page.evaluate(
                () => JSON.parse(localStorage.getItem('reactor:view') ?? '{}').previewTheme
            )
        )
        .toBe('dark');
    await page.reload();
    await openEditor(page, ['Inspector', 'Variables']);
    await expect(page.getByLabel('Preview theme', { exact: true })).toHaveValue('dark');
    await expect.poll(fill).toBe('rgb(221, 238, 255)');
    await pointer(page, 'pointerdown', { x: 125, y: 125 });
    await pointer(page, 'pointerup', { x: 125, y: 125 });
    await expect(page.getByLabel('Fill', { exact: true })).toHaveText('◆ Ink');
    await page.setViewportSize({ width: 700, height: 800 });
    await expect(page.getByLabel('Preview theme', { exact: true })).toBeVisible();
    await page
        .getByRole('button', { name: 'Use Light value for Ink in Dark', exact: true })
        .click();
    await expect.poll(fill).toBe('rgb(17, 34, 51)');
});
