import { expect, test, type Page } from '@playwright/test';
import { drawRect, openEditor, shapes } from './support/editor';

const showDocuments = (page: Page) =>
    page.getByRole('link', { name: 'Documents' }).dispatchEvent('click');
const rows = (page: Page) => page.locator('main tbody tr');
const shapeCount = (page: Page, row: number) => rows(page).nth(row).locator('td').first();
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function drawShapeAndShowDocuments(page: Page) {
    await openEditor(page, ['Menu Bar']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await showDocuments(page);
}

test('documents can be listed, cloned, deleted, created and opened', async ({ page }) => {
    await drawShapeAndShowDocuments(page);

    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('document-1');
    await expect(rows(page).first()).toContainText('Current');
    await expect(shapeCount(page, 0)).toHaveText('1');

    await button(page, 'Clone document-1').click();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(1)).toContainText('document-1 copy');

    await button(page, 'Delete document-1 copy').click();
    await button(page, 'Cancel').click();
    await expect(rows(page)).toHaveCount(2);

    await button(page, 'Delete document-1 copy').click();
    await button(page, 'Delete').click();
    await expect(rows(page)).toHaveCount(1);

    await button(page, 'New document').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(shapes(page)).toHaveCount(0);

    await showDocuments(page);
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(1)).toContainText('document-2');
    await expect(rows(page).nth(1)).toContainText('Current');

    await button(page, 'Open document-1').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(shapes(page)).toHaveCount(1);
});

test('shortcuts do not change the shapes of a document that is not shown', async ({ page }) => {
    await drawShapeAndShowDocuments(page);
    await expect(shapeCount(page, 0)).toHaveText('1');

    await page.keyboard.press('Delete');
    await button(page, 'Open document-1').click();

    await expect(shapes(page)).toHaveCount(1);
});
