import { expect, test, type Page } from '@playwright/test';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { drawRect, openEditor, shapes } from './support/editor';

const showDocuments = (page: Page) =>
    page
        .getByRole('navigation', { name: 'Application' })
        .getByRole('link', { name: 'Documents' })
        .dispatchEvent('click');
const rows = (page: Page) => page.getByRole('list', { name: 'Documents' }).getByRole('listitem');
const shapeCount = (page: Page, row: number) =>
    rows(page)
        .nth(row)
        .getByText(/^\d+ shapes?$/);
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
    await expect(shapeCount(page, 0)).toHaveText('1 shape');
    await expect(
        rows(page).first().getByRole('img', { name: 'Preview of document-1' }).locator('rect')
    ).toHaveCount(1);
    await expect(button(page, 'New document').locator('svg')).toHaveCount(1);
    await expect(button(page, 'Clone document-1')).toHaveAttribute('title', 'Clone document-1');
    await expect(button(page, 'Clone document-1').locator('svg')).toHaveCount(1);
    expect((await button(page, 'Clone document-1').boundingBox())!.width).toBe(32);
    await expect(button(page, 'Delete document-1')).toHaveAttribute('title', 'Delete document-1');
    await expect(button(page, 'Delete document-1').locator('svg')).toHaveCount(1);

    await button(page, 'Clone document-1').click();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(1)).toContainText('document-1 copy');

    await button(page, 'Delete document-1 copy').click();
    const confirmation = page.getByRole('dialog', { name: 'Delete this document?' });
    await expect(confirmation).toContainText('document-1 copy');
    await confirmation.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirmation).not.toBeVisible();
    await expect(rows(page)).toHaveCount(2);

    await button(page, 'Delete document-1 copy').click();
    await page.keyboard.press('Escape');
    await expect(confirmation).not.toBeVisible();
    await expect(rows(page)).toHaveCount(2);

    await button(page, 'Delete document-1 copy').click();
    await confirmation.getByRole('button', { name: 'Delete document' }).click();
    await expect(rows(page)).toHaveCount(1);

    await button(page, 'New document').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(shapes(page)).toHaveCount(0);

    await showDocuments(page);
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(1)).toContainText('document-2');
    await expect(rows(page).nth(1)).toContainText('Current');
    await expect(rows(page).nth(1)).toContainText('Empty canvas');

    await expect(button(page, 'Open document-1')).toHaveText('document-1');
    await button(page, 'Open document-1').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(shapes(page)).toHaveCount(1);
});

test('a document can be renamed from its pencil button', async ({ page }) => {
    await drawShapeAndShowDocuments(page);

    await button(page, 'Rename document-1').click();
    const name = page.getByRole('textbox', { name: 'Name for document-1' });
    await expect(name).toBeFocused();
    await name.fill('Storyboard');
    await name.press('Enter');
    await expect(rows(page).first()).toContainText('Storyboard');
    await expect(button(page, 'Rename Storyboard')).toBeFocused();

    await button(page, 'Rename Storyboard').click();
    await page.getByRole('textbox', { name: 'Name for Storyboard' }).fill('Discarded name');
    await page.getByRole('textbox', { name: 'Name for Storyboard' }).press('Escape');
    await expect(rows(page).first()).toContainText('Storyboard');
    await expect(rows(page).first()).not.toContainText('Discarded name');
    await expect(button(page, 'Rename Storyboard')).toBeFocused();
});

test('a document thumbnail includes instance text overrides after loading', async ({ page }) => {
    const label = createShape({
        type: 'text',
        name: 'Label',
        order: 'a0',
        position: { x: 100, y: 100 },
        value: 'I',
        fontSize: 24
    });
    const propId = 'label-text';
    const component = createComponent({
        shapesIds: [label.id],
        props: [{ id: propId, label: 'Text', shapeId: label.id, key: 'text' }]
    });
    const longerText = 'W'.repeat(60);
    const instance = createShape({
        type: 'instance',
        name: 'Long label',
        order: 'a1',
        componentId: component.id,
        position: { x: 300, y: 300 },
        overrides: { [propId]: longerText }
    });
    const document = createDocument({
        shapes: { [label.id]: label, [instance.id]: instance },
        components: { [component.id]: component }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.goto('/documents');

    const preview = page.getByRole('img', { name: `Preview of ${document.name}` });
    await expect(preview.locator('text').last()).toHaveText(longerText);
    await expect
        .poll(() =>
            preview.evaluate((svg: SVGSVGElement) => {
                const content = svg.querySelector('g')!.getBBox();
                const frame = svg.viewBox.baseVal;

                return (
                    frame.x <= content.x &&
                    frame.y <= content.y &&
                    frame.x + frame.width >= content.x + content.width &&
                    frame.y + frame.height >= content.y + content.height
                );
            })
        )
        .toBe(true);
});

test('shortcuts do not change the shapes of a document that is not shown', async ({ page }) => {
    await drawShapeAndShowDocuments(page);
    await expect(shapeCount(page, 0)).toHaveText('1 shape');

    await page.keyboard.press('Delete');
    await button(page, 'Open document-1').click();

    await expect(shapes(page)).toHaveCount(1);
});

test('documents created or deleted in one tab are in the others', async ({ page }) => {
    const otherTab = await page.context().newPage();

    await openEditor(page, ['Menu Bar']);
    await openEditor(otherTab, ['Menu Bar']);
    await showDocuments(page);
    await showDocuments(otherTab);
    await expect(rows(otherTab)).toHaveCount(1);

    await button(page, 'Clone document-1').click();
    await expect(rows(otherTab)).toHaveCount(2);
    await expect(rows(otherTab).nth(1)).toContainText('document-1 copy');

    await button(page, 'Delete document-1 copy').click();
    await page
        .getByRole('dialog', { name: 'Delete this document?' })
        .getByRole('button', { name: 'Delete document' })
        .click();
    await expect(rows(otherTab)).toHaveCount(1);
});
