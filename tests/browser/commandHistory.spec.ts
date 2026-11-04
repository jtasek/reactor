import { expect, test, type Page } from '@playwright/test';
import { openEditor, shapes } from './support/editor';

const command = (page: Page) => page.getByRole('combobox', { name: 'Command' });
const repeat = (page: Page) =>
    page.getByRole('button', { name: 'Repeat last command', exact: true });

async function run(page: Page, input: string) {
    await command(page).fill(input);
    await command(page).press('Enter');
}

async function reopen(page: Page) {
    await page.getByRole('button', { name: 'Close Command Line' }).click();
    await page.getByRole('checkbox', { name: 'Command Line', exact: true }).check();
}

test('recent commands survive closing, preserve parameters, deduplicate and clear', async ({
    page
}, testInfo) => {
    await openEditor(page, ['Command Line']);
    await run(page, 'rectangle w=80 h=40 name="Card"');
    await repeat(page).click();
    await expect(shapes(page)).toHaveCount(2);
    await run(page, 'undo');
    await expect(shapes(page)).toHaveCount(1);
    await run(page, 'circle r=-2');
    await expect(page.getByRole('status')).toContainText('positive');
    await reopen(page);
    await expect(page.getByText('Recent commands', { exact: true })).toBeVisible();
    // Undo is not recorded, and suggested actions stay listed below the recent ones.
    const recentList = page.getByRole('listbox', { name: 'Recent commands' });
    await expect(recentList.getByRole('option')).toHaveCount(1);
    await expect(page.getByText('Suggested actions', { exact: true })).toBeVisible();
    await expect(
        page.getByRole('listbox', { name: 'Commands' }).getByRole('option').first()
    ).toBeVisible();
    await recentList.getByRole('option').filter({ hasText: 'Create rectangle' }).click();
    const width = page.getByRole('textbox', { name: 'Width', exact: true });
    await expect(width).toBeFocused();
    await expect(width).toHaveValue('80');
    await expect(page.getByRole('textbox', { name: 'Height', exact: true })).toHaveValue('40');
    await width.fill('120');
    await width.press('Enter');
    await expect(shapes(page)).toHaveCount(2);
    await expect(shapes(page).locator('rect[data-cy][width="120"]')).toHaveCount(1);
    await reopen(page);
    await page.screenshot({ path: testInfo.outputPath('recent-commands.png') });
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(repeat(page)).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('recent-commands-narrow.png') });
    await page.getByRole('button', { name: 'Clear recent commands' }).click();
    await expect(page.getByText('Recent commands', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Suggested actions', { exact: true })).toBeVisible();
    await expect(repeat(page)).toHaveCount(0);
});

test('repeat uses current selection, remains one undo step and rechecks locks', async ({
    page
}) => {
    await openEditor(page, ['Command Line', 'Explorer']);
    await run(page, 'rectangle x=10 y=20 w=40 h=30 name="First"');
    await run(page, 'rectangle x=100 y=20 w=40 h=30 name="Second"');
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'First', exact: true }).click();
    await run(page, 'move x=10');
    await expect(shapes(page).locator('rect[data-cy="First"]')).toHaveAttribute('x', '20');
    await explorer.getByRole('button', { name: 'Second', exact: true }).click();
    await expect(repeat(page)).toHaveAccessibleDescription(/Repeat runs move x=10/);
    await repeat(page).click();
    await expect(shapes(page).locator('rect[data-cy="Second"]')).toHaveAttribute('x', '110');
    const bar = page.getByRole('list', { name: 'Commands' });
    await bar.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(shapes(page).locator('rect[data-cy="Second"]')).toHaveAttribute('x', '100');
    await expect(shapes(page).locator('rect[data-cy="First"]')).toHaveAttribute('x', '20');
    await bar.getByRole('button', { name: 'Lock', exact: true }).click();
    await repeat(page).click();
    await expect(page.getByRole('status')).toContainText('editable');
    await expect(shapes(page).locator('rect[data-cy="Second"]')).toHaveAttribute('x', '100');
});

test('history is scoped to its document and is cleared by reload', async ({ page }) => {
    await openEditor(page, ['Command Line']);
    await run(page, 'rectangle w=80');
    await page
        .getByRole('navigation', { name: 'Application' })
        .getByRole('link', { name: 'Documents' })
        .click();
    await page.getByRole('button', { name: 'New document', exact: true }).click();
    await expect(page.locator('svg#surface')).toBeVisible();
    await expect(repeat(page)).toHaveCount(0);
    await expect(page.getByText('Recent commands', { exact: true })).toHaveCount(0);
    await expect(command(page)).toBeVisible();
    await run(page, 'circle r=20');
    await expect(repeat(page)).toBeVisible();
    await page.reload();
    await expect(page.locator('svg#surface')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(command(page)).toBeVisible();
    await expect(repeat(page)).toHaveCount(0);
});

test('an unavailable repeat names its command and says why when pressed', async ({ page }) => {
    await openEditor(page, ['Command Line', 'Explorer']);
    await run(page, 'rectangle x=10 y=20 w=40 h=30 name="First"');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'First', exact: true })
        .click();
    await run(page, 'r=4');
    await page.keyboard.press('Escape');
    await page.locator('svg#surface').click({ position: { x: 600, y: 500 } });
    await page.keyboard.press('ControlOrMeta+k');
    await expect(repeat(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText(/Repeat runs r=4/)).toBeVisible();
    // Playwright won't click aria-disabled; keyboard users can still reach and press it.
    await repeat(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('not available');
});
