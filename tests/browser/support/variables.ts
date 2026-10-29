import { expect, type Page } from '@playwright/test';

export const variablesPanel = (page: Page) =>
    page.getByRole('region', { name: 'Variables', exact: true });

async function closePanelPicker(page: Page) {
    const picker = page.getByRole('button', { name: 'More panels', exact: true });
    if ((await picker.getAttribute('aria-pressed')) === 'true') {
        await picker.click();
    }
}

export async function selectVariable(page: Page, name: string) {
    await closePanelPicker(page);
    const panel = variablesPanel(page);
    await panel.getByRole('button', { name: 'Variables', exact: true }).click();
    const picker = panel.getByLabel('Selected variable', { exact: true });

    if (await picker.isVisible()) {
        await picker.selectOption({ label: name });

        return;
    }
    await panel.getByRole('button', { name: `Edit variable ${name}`, exact: true }).click();
}

export async function createVariable(page: Page, name: string, type = 'Color') {
    await closePanelPicker(page);
    const panel = variablesPanel(page);
    const input = panel.getByLabel('New variable name', { exact: true });
    if (!(await input.isVisible())) {
        await panel
            .getByRole('button', { name: 'New variable', exact: true })
            .filter({ visible: true })
            .click();
    }
    await input.fill(name);
    await panel.getByLabel('New variable type', { exact: true }).selectOption({ label: type });
    await panel.getByRole('button', { name: 'Create variable', exact: true }).click();
}

export async function deleteVariable(page: Page, name: string) {
    const panel = variablesPanel(page);
    const remove = panel
        .getByRole('group', { name: `Actions for ${name} menu`, exact: true })
        .getByRole('button', { name: 'Delete variable', exact: true });
    if (!(await remove.isVisible())) {
        await panel.getByLabel(`Actions for ${name}`, { exact: true }).click();
    }
    await remove.click();
}

export async function openModePreview(page: Page) {
    await closePanelPicker(page);
    await openPanelOptions(page);
    const summary = variablesPanel(page).getByText('Canvas preview', { exact: true });
    await expect(summary).toBeVisible();
    if (!(await summary.evaluate((element) => element.closest('details')?.open))) {
        await summary.click();
    }
}

export async function openPanelOptions(page: Page) {
    await closePanelPicker(page);
    const button = variablesPanel(page).getByRole('button', { name: 'Panel options', exact: true });
    if ((await button.getAttribute('aria-expanded')) !== 'true') {
        await button.click();
    }
}

export async function openVariableSettings(page: Page, name: string) {
    const panel = variablesPanel(page);
    if (await panel.getByRole('region', { name: 'Variable settings', exact: true }).isVisible()) {
        return;
    }
    await panel.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
    await panel.getByRole('button', { name: 'Variable settings', exact: true }).click();
}

export async function resetModeValue(page: Page, name: string, mode: string, defaultMode: string) {
    const panel = variablesPanel(page);
    await panel
        .getByRole('button', { name: `Actions for ${mode} value of ${name}`, exact: true })
        .click();
    await panel.getByRole('button', { name: `Reset to ${defaultMode} value`, exact: true }).click();
}
