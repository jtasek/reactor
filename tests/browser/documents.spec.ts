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

async function openDocumentExamples(page: Page) {
    const shape = createShape({
        type: 'rectangle',
        name: 'Preview rectangle',
        position: { x: 20, y: 30 },
        size: { width: 100, height: 60 },
        order: 'a0'
    });
    const documents = [
        createDocument({
            name: 'Interface kit',
            modified: new Date(2026, 9, 13, 8),
            tags: ['UI kit', 'Client project'],
            shapes: { [shape.id]: shape }
        }),
        createDocument({
            name: 'Checkout flow',
            modified: new Date(2026, 9, 12, 9),
            tags: ['Prototype', ' client PROJECT ']
        }),
        createDocument({
            name: 'Mobile onboarding',
            modified: new Date(2026, 9, 3, 10),
            tags: ['Prototype', 'Mobile', 'Client project']
        }),
        createDocument({ name: 'Archive', modified: new Date(2026, 8, 3, 11) })
    ];
    const saved = serializePersistedState({
        currentDocumentId: documents[0].id,
        documents: Object.fromEntries(documents.map((document) => [document.id, document]))
    });

    await page.clock.setFixedTime(new Date(2026, 9, 13, 12));
    await page.addInitScript((raw) => {
        if (localStorage.getItem('reactor') === null) {
            localStorage.setItem('reactor', raw);
        }
    }, JSON.stringify(saved));
    await page.goto('/documents');
    await expect(rows(page)).toHaveCount(documents.length);
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
    // The newest edit comes first.
    await expect(rows(page).first()).toContainText('document-1 copy');

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
    await expect(rows(page).first()).toContainText('document-2');
    await expect(rows(page).first()).toContainText('Current');
    await expect(rows(page).first()).toContainText('Empty canvas');

    await expect(button(page, 'Open document-1')).toHaveText('document-1');
    await button(page, 'Open document-1').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(shapes(page)).toHaveCount(1);
});

test('double-clicking a card opens it without intercepting controls or dialogs', async ({
    page
}) => {
    await openDocumentExamples(page);

    await button(page, 'Rename Interface kit').dblclick();
    const name = page.getByRole('textbox', { name: 'Name for Interface kit' });
    await name.dblclick();
    await expect(page).toHaveURL(/\/documents$/);
    await name.press('Escape');

    await rows(page).first().getByRole('button', { name: 'Edit tags' }).click();
    const tags = page.getByRole('dialog', { name: 'Edit tags' });
    await tags.getByRole('heading', { name: 'Edit tags' }).dblclick();
    await expect(page).toHaveURL(/\/documents$/);
    await page.keyboard.press('Escape');

    const preview = page.getByRole('img', { name: 'Preview of Interface kit' });
    await preview.click();
    await expect(page).toHaveURL(/\/documents$/);
    await preview.dblclick();
    await expect(page).toHaveURL(/\/$/);
    await expect(shapes(page)).toHaveCount(1);

    await showDocuments(page);
    await button(page, 'List view').click();
    await rows(page)
        .filter({ has: button(page, 'Open Checkout flow') })
        .locator('time')
        .dblclick();
    await expect(page).toHaveURL(/\/$/);
    await expect(shapes(page)).toHaveCount(0);
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
    await expect(rows(otherTab).first()).toContainText('document-1 copy');

    await button(page, 'Delete document-1 copy').click();
    await page
        .getByRole('dialog', { name: 'Delete this document?' })
        .getByRole('button', { name: 'Delete document' })
        .click();
    await expect(rows(otherTab)).toHaveCount(1);
});

test('document cards keep their title and date above the preview and switch to a list', async ({
    page
}) => {
    await openDocumentExamples(page);

    // Newest edits first.
    await expect(rows(page).getByRole('button', { name: /^Open / })).toHaveText([
        'Interface kit',
        'Checkout flow',
        'Mobile onboarding',
        'Archive'
    ]);

    const card = rows(page).filter({ has: button(page, 'Open Interface kit') });
    const preview = card.getByRole('img', { name: 'Preview of Interface kit' });
    const name = card.getByRole('button', { name: 'Open Interface kit', exact: true });
    const header = await card.locator('header').boundingBox();
    const cardPreview = await preview.boundingBox();
    const title = await name.boundingBox();
    const date = await card.locator('time').boundingBox();

    await expect(card.locator('time')).toHaveText('Today');
    expect(header!.y + header!.height).toBeLessThanOrEqual(cardPreview!.y);
    expect(title!.x + title!.width).toBeLessThanOrEqual(date!.x);

    for (const action of ['Rename', 'Clone', 'Delete']) {
        const icon = card.getByRole('button', { name: `${action} Interface kit` }).locator('svg');

        await expect(icon).toHaveAttribute('fill', 'none');
        await expect(icon).toHaveAttribute('stroke', 'currentColor');
        await expect(icon).toHaveAttribute('stroke-width', '1.5');
    }

    await button(page, 'List view').click();
    await expect(button(page, 'List view')).toHaveAttribute('aria-pressed', 'true');
    const listPreview = await preview.boundingBox();
    const listTitle = await name.boundingBox();

    expect(listPreview!.height).toBeLessThan(cardPreview!.height);
    expect(listPreview!.x + listPreview!.width).toBeLessThan(listTitle!.x);
    // The list marks the current document and keeps an empty preview's text out of its tile.
    await expect(card.getByText('Current', { exact: true })).toBeVisible();
    await expect(
        rows(page)
            .filter({ has: button(page, 'Open Archive') })
            .getByText('Empty canvas')
    ).toBeHidden();

    await button(page, 'Card view').click();
    await expect(button(page, 'Card view')).toHaveAttribute('aria-pressed', 'true');
    expect((await preview.boundingBox())!.height).toBeGreaterThan(listPreview!.height);
});

test('document name, date and tag filters work together', async ({ page }) => {
    await openDocumentExamples(page);

    const search = page.getByRole('searchbox', { name: 'Search documents' });
    const date = page.getByRole('button', { name: 'Last edited' });
    const chooseDate = async (label: string) => {
        await date.click();
        await page.getByRole('menuitemradio', { name: label, exact: true }).click();
        await expect(date).toBeFocused();
    };

    await search.fill(' CHECKOUT ');
    await expect(rows(page)).toHaveCount(1);
    await expect(button(page, 'Open Checkout flow')).toBeVisible();
    await chooseDate('Today');
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'No documents found' })).toBeVisible();
    await search.fill('');
    await expect(rows(page)).toHaveCount(1);
    await expect(button(page, 'Open Interface kit')).toBeVisible();
    await chooseDate('Past 7 days');
    await expect(rows(page)).toHaveCount(2);
    await chooseDate('Past 30 days');
    await expect(rows(page)).toHaveCount(3);
    await chooseDate('Any time');
    await expect(rows(page)).toHaveCount(4);

    await button(page, 'Filter by tags').click();
    const picker = page.getByRole('menu', { name: 'Filter by tags' });
    const clientTag = picker.getByRole('menuitemcheckbox', { name: /^Client project$/i });

    await expect(clientTag).toHaveCount(1);
    await clientTag.click();
    await expect(clientTag).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(picker).not.toBeVisible();
    await expect(button(page, 'Filter by tags')).toBeFocused();
    await expect(rows(page)).toHaveCount(3);
    await expect(button(page, 'Open Checkout flow')).toBeVisible();
    await chooseDate('Today');
    await expect(rows(page)).toHaveCount(1);
    await button(page, 'Clear filters').click();
    await expect(rows(page)).toHaveCount(4);
    await date.click();
    await expect(page.getByRole('menuitemradio', { name: 'Any time' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitemradio', { name: 'Today', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(rows(page)).toHaveCount(1);
    await button(page, 'Filter by tags').click();
    await search.click();
    await expect(picker).not.toBeVisible();
});

test('new tags persist and +N expands all document tags inline', async ({ page }) => {
    await openDocumentExamples(page);

    const card = rows(page).filter({ has: button(page, 'Open Interface kit') });

    await card.getByRole('button', { name: 'Edit tags', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Edit tags' });

    await picker.getByRole('searchbox', { name: 'Search tags' }).fill('Design review');
    await picker.getByRole('button', { name: 'Create “Design review”' }).click();
    await expect(picker.getByRole('checkbox', { name: 'Design review' })).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(card.getByRole('button', { name: 'Design review', exact: true })).toHaveCount(0);
    await card.getByRole('button', { name: '+1', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Less', exact: true })).toHaveAttribute(
        'aria-expanded',
        'true'
    );
    for (const tag of ['UI kit', 'Client project', 'Design review']) {
        await expect(card.getByRole('button', { name: tag, exact: true })).toBeVisible();
    }

    await button(page, 'Open Interface kit').click();
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await showDocuments(page);
    await page.reload();
    await expect(card.getByRole('button', { name: '+1', exact: true })).toBeVisible();
    await card.getByRole('button', { name: '+1', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Design review', exact: true })).toBeVisible();
});

test('tag edits apply at once, keep the focus where it was and stay as the picker closes', async ({
    page
}) => {
    await openDocumentExamples(page);

    const card = rows(page).filter({ has: button(page, 'Open Interface kit') });
    const edit = card.getByRole('button', { name: 'Edit tags', exact: true });

    await edit.click();
    const picker = page.getByRole('dialog', { name: 'Edit tags' });
    const uiKit = picker.getByRole('checkbox', { name: 'UI kit', exact: true });

    await uiKit.uncheck();
    await expect(card.getByRole('button', { name: 'UI kit', exact: true })).toHaveCount(0);
    // The card renders again with its new tags; the focus stays on the tag.
    await expect(uiKit).toBeFocused();
    // Taken off its only document, the tag stays listed to be put back.
    await expect(uiKit).not.toBeChecked();

    await picker.getByRole('searchbox', { name: 'Search tags' }).fill('Fresh tag');
    await picker.getByRole('button', { name: 'Create “Fresh tag”' }).click();
    await expect(card.getByRole('button', { name: 'Fresh tag', exact: true })).toBeVisible();

    await page.getByRole('heading', { name: 'Documents' }).click();
    await expect(picker).not.toBeVisible();
    await expect(card.getByRole('button', { name: 'Fresh tag', exact: true })).toBeVisible();

    // Focus leaving the picker closes it.
    await edit.click();
    await picker.getByRole('searchbox', { name: 'Search tags' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(picker).not.toBeVisible();
});

test('document search, filter typography and tag actions use consistent styling', async ({
    page
}) => {
    await openDocumentExamples(page);
    const search = page.getByRole('searchbox', { name: 'Search documents' });
    await search.focus();
    await expect(search).toHaveCSS('outline-style', 'none');
    await expect(search.locator('..')).toHaveCSS('outline-style', 'solid');
    const date = page.getByRole('button', { name: /^Last edited/ });
    const tags = button(page, 'Filter by tags');
    const typography = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight];
    };
    expect(await date.evaluate(typography)).toEqual(await tags.evaluate(typography));
    await tags.click();
    const menu = page.getByRole('menu', { name: 'Filter by tags' });
    const label = menu.getByRole('menuitemcheckbox').first().locator('span').last();
    await expect(label).toHaveCSS(
        'font-family',
        await tags.evaluate((element) => getComputedStyle(element).fontFamily)
    );
    await page.keyboard.press('Escape');
    // The date filter's name holds its visible label.
    await expect(date).toHaveAccessibleName('Last edited: Any time');
});

test('a tag keeps the color picked for it on every document and after reloading', async ({
    page
}) => {
    await openDocumentExamples(page);

    const card = rows(page).filter({ has: button(page, 'Open Interface kit') });
    const clientTags = page
        .getByRole('list', { name: 'Documents' })
        .getByRole('button', { name: /^client project$/i });

    // Mobile onboarding shows its third tag, Client project, behind +1.
    await expect(clientTags).toHaveCount(2);
    await card.getByRole('button', { name: 'Edit tags', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Edit tags' });
    const color = picker.getByRole('button', { name: 'Color of Client project' });

    await color.click();
    await picker
        .getByRole('radiogroup', { name: 'Colors for Client project' })
        .getByRole('radio', { name: 'purple' })
        .click();
    await expect(color).toBeFocused();
    await expect(color).toHaveAttribute('data-tone', 'purple');
    for (const tag of await clientTags.all()) {
        await expect(tag).toHaveAttribute('data-tone', 'purple');
    }
    // Picking a color is not an edit: the documents keep their order and dates.
    await expect(card.locator('time')).toHaveText('Today');
    await page.keyboard.press('Escape');

    await button(page, 'Open Interface kit').click();
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await showDocuments(page);
    await page.reload();
    await expect(clientTags).toHaveCount(2);
    for (const tag of await clientTags.all()) {
        await expect(tag).toHaveAttribute('data-tone', 'purple');
    }
});
