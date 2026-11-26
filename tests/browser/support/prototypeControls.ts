import { expect, type Locator, type Page } from '@playwright/test';

/** Opens Settings from the bar's More menu. */
export async function openPrototypeSettings(page: Page) {
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Prototype settings', exact: true }).click();

    return page.getByRole('dialog', { name: 'Prototype settings' });
}

/** Opens the Device menu above the player, where the size is set. */
export async function openDeviceMenu(page: Page) {
    await page.getByRole('button', { name: 'Device', exact: true }).click();

    return page.getByRole('dialog', { name: 'Device' });
}

const SIZE_FIELDS = ['Prototype width', 'Prototype height'];

/** The size lives in the Device menu; everything else in Settings. */
async function withSetting(page: Page, name: string, act: (field: Locator) => Promise<void>) {
    if (SIZE_FIELDS.includes(name)) {
        const menu = await openDeviceMenu(page);
        await act(menu.getByLabel(name, { exact: true }));
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();

        return;
    }
    const settings = await openPrototypeSettings(page);
    await act(settings.getByLabel(name, { exact: true }));
    await settings.getByRole('button', { name: 'Close', exact: true }).click();
}

export async function setPrototypeSetting(page: Page, name: string, value: string) {
    await withSetting(page, name, async (field) => {
        if (await field.evaluate((element) => element.tagName === 'SELECT')) {
            await field.selectOption(value);
        } else {
            await field.fill(value);
            await field.press('Tab');
        }
    });
}

export async function expectPrototypeSetting(page: Page, name: string, value: string) {
    await withSetting(page, name, (field) => expect(field).toHaveValue(value));
}
