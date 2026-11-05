import type { Page } from '@playwright/test';

/** Settings are session controls, revealed only when the person needs them. */
export async function setPrototypeSetting(page: Page, name: string, value: string) {
    await page.getByRole('button', { name: 'Prototype settings', exact: true }).click();
    const field = page
        .getByRole('dialog', { name: 'Prototype settings' })
        .getByLabel(name, { exact: true });
    if (await field.evaluate((element) => element.tagName === 'SELECT')) {
        await field.selectOption(value);
    } else {
        await field.fill(value);
        await field.press('Tab');
    }
    await page.getByRole('button', { name: 'Done', exact: true }).click();
}
