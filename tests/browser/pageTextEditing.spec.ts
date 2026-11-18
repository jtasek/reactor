import { expect, test, type Page } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';
import type { Frame } from 'src/app/types';

const frame = (id: string, x: number, changes: Partial<Frame>): Frame => ({
    id,
    name: id,
    kind: 'frame',
    position: { x, y: 100 },
    size: { width: 320, height: 240 },
    visible: true,
    locked: false,
    ...changes
});

/** A page with a headline, shown through two views. */
async function openPage(page: Page) {
    const title = createShape({
        type: 'text',
        name: 'Headline',
        order: 'a0',
        value: 'Welcome',
        fontSize: 24,
        position: { x: 140, y: 160 },
        parentFrameId: 'home'
    });
    title.id = 'title';
    const document = createDocument({
        id: 'page-text',
        name: 'Page text',
        frames: {
            home: frame('home', 100, { name: 'Home', kind: 'screen', definitionOnly: true }),
            desktop: frame('desktop', 100, { kind: 'view', screenId: 'home' }),
            phone: frame('phone', 500, { kind: 'view', screenId: 'home' })
        },
        shapes: { title },
        shapesIds: ['title']
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await openEditor(page);

    const headline = (view: string) =>
        page.locator(`#screen-views [data-screen-view="${view}"] [data-cy="Headline"]`);

    return { headline, field: page.locator('svg#surface foreignObject input[aria-label="Text"]') };
}

test('a double click on page text changes it where it is shown, in every view of the page', async ({
    page
}) => {
    const { headline, field } = await openPage(page);

    await headline('phone').dblclick();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('Welcome');

    await page.keyboard.type('Hello');
    await page.keyboard.press('Enter');
    await expect(field).toHaveCount(0);
    await expect(headline('phone')).toHaveText('Hello');
    await expect(headline('desktop')).toHaveText('Hello');

    await page.keyboard.press('ControlOrMeta+z');
    await expect(headline('desktop')).toHaveText('Welcome');
});

test('Escape leaves page text as it was', async ({ page }) => {
    const { headline, field } = await openPage(page);

    await headline('desktop').dblclick();
    await page.keyboard.type('Other');
    await page.keyboard.press('Escape');

    await expect(field).toHaveCount(0);
    await expect(headline('desktop')).toHaveText('Welcome');
});
