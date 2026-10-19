import { expect, test, type Locator, type Page } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { drawRect, openEditor, pointer, selectTool } from './support/editor';

const frame = (page: Page, name: string) =>
    page.getByRole('button', { name: `Frame ${name}`, exact: true });
const explorer = (page: Page) => page.getByRole('region', { name: 'Explorer' });
const artwork = (page: Page) => page.locator('svg#surface rect[data-cy="Artwork"]');
const geometry = (rect: Locator) =>
    rect.evaluate((element) =>
        ['x', 'y', 'width', 'height'].map((attribute) => Number(element.getAttribute(attribute)))
    );

async function drawFrame(
    page: Page,
    name: string,
    from: { x: number; y: number },
    to: { x: number; y: number }
) {
    await selectTool(page, 'Draw a screen frame');
    await pointer(page, 'pointerdown', from);
    await pointer(page, 'pointermove', to);
    await pointer(page, 'pointerup', to);
    await page.getByLabel('Frame name', { exact: true }).fill(name);
    await page.getByLabel('Frame name', { exact: true }).press('Enter');
    await expect(frame(page, name)).toBeVisible();
}

test('explicit parents preserve positions, move descendants, and survive boundary deletion', async ({
    page
}) => {
    await openEditor(page, ['Inspector', 'Explorer']);
    await drawFrame(page, 'Outer', { x: 100, y: 120 }, { x: 650, y: 520 });
    await drawFrame(page, 'Inner', { x: 200, y: 220 }, { x: 500, y: 420 });
    const outerId = (await frame(page, 'Outer').getAttribute('data-frame'))!;
    const innerId = (await frame(page, 'Inner').getAttribute('data-frame'))!;

    // Being inside another frame does not establish membership.
    await expect(page.getByLabel('Frame parent', { exact: true })).toHaveValue('');
    await page.getByLabel('Frame parent', { exact: true }).selectOption({ label: 'Outer' });
    await expect
        .poll(() => geometry(frame(page, 'Inner').locator('rect')))
        .toEqual([200, 220, 300, 200]);
    const outerTree = explorer(page)
        .getByRole('button', { name: 'Outer', exact: true })
        .locator('xpath=ancestor::li[1]');
    await expect(outerTree.getByRole('button', { name: 'Inner', exact: true })).toBeVisible();

    await drawRect(page, { x: 250, y: 260 }, { x: 310, y: 300 });
    await page.getByLabel('Name', { exact: true }).fill('Artwork');
    await page.getByLabel('Name', { exact: true }).press('Enter');
    await expect(page.getByLabel('Selection parent', { exact: true })).toHaveValue('');
    await page.getByLabel('Selection parent', { exact: true }).selectOption({ label: 'Inner' });
    await expect.poll(() => geometry(artwork(page))).toEqual([250, 260, 60, 40]);

    await explorer(page).getByRole('button', { name: 'Outer', exact: true }).click();
    await pointer(page, 'pointerdown', {
        x: 100,
        y: 112,
        target: `[data-frame="${outerId}"] text`
    });
    await pointer(page, 'pointermove', { x: 140, y: 162 });
    await pointer(page, 'pointerup', { x: 140, y: 162 });
    await expect
        .poll(() => geometry(frame(page, 'Outer').locator('rect')))
        .toEqual([140, 170, 550, 400]);
    await expect
        .poll(() => geometry(frame(page, 'Inner').locator('rect')))
        .toEqual([240, 270, 300, 200]);
    await expect.poll(() => geometry(artwork(page))).toEqual([290, 310, 60, 40]);

    // Resizing changes the boundary without scaling or moving its contents.
    await pointer(page, 'pointerdown', {
        x: 690,
        y: 570,
        target: `[data-frame="${outerId}"] [data-type="bottomRight"]`
    });
    await pointer(page, 'pointermove', { x: 750, y: 630 });
    await pointer(page, 'pointerup', { x: 750, y: 630 });
    await expect
        .poll(() => geometry(frame(page, 'Outer').locator('rect')))
        .toEqual([140, 170, 610, 460]);
    await expect
        .poll(() => geometry(frame(page, 'Inner').locator('rect')))
        .toEqual([240, 270, 300, 200]);
    await expect.poll(() => geometry(artwork(page))).toEqual([290, 310, 60, 40]);

    await page.reload();
    await expect(frame(page, 'Outer')).toBeVisible();
    await expect(outerTree.getByRole('button', { name: 'Inner', exact: true })).toBeVisible();
    await explorer(page).getByRole('button', { name: 'Inner', exact: true }).click();
    await expect(page.getByLabel('Frame parent', { exact: true })).toHaveValue(outerId);
    await expect
        .poll(() => geometry(frame(page, 'Inner').locator('rect')))
        .toEqual([240, 270, 300, 200]);
    await explorer(page).getByRole('button', { name: 'Artwork', exact: true }).click();
    await expect(page.getByLabel('Selection parent', { exact: true })).toHaveValue(innerId);
    await expect.poll(() => geometry(artwork(page))).toEqual([290, 310, 60, 40]);
    await page.screenshot({ path: '/tmp/reactor-frame-membership-normal.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(page.getByLabel('Selection parent', { exact: true })).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-frame-membership-narrow.png' });

    await frame(page, 'Outer').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Delete');
    await expect(frame(page, 'Outer')).toHaveCount(0);
    await expect(frame(page, 'Inner')).toBeVisible();
    await expect.poll(() => geometry(artwork(page))).toEqual([290, 310, 60, 40]);
    await frame(page, 'Inner').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Frame parent', { exact: true })).toHaveValue('');
    await expect
        .poll(() => geometry(frame(page, 'Inner').locator('rect')))
        .toEqual([240, 270, 300, 200]);
    await page.keyboard.press('Delete');
    await expect(frame(page, 'Inner')).toHaveCount(0);
    await explorer(page).getByRole('button', { name: 'Artwork', exact: true }).click();
    await expect(page.getByLabel('Selection parent', { exact: true })).toHaveValue('');
    await expect.poll(() => geometry(artwork(page))).toEqual([290, 310, 60, 40]);
});

test('lets a person repair a concurrent parent cycle by explicitly choosing Canvas', async ({
    page
}) => {
    const box = {
        position: { x: 200, y: 220 },
        size: { width: 300, height: 200 },
        visible: true,
        locked: false
    };
    const document = createDocument({
        id: 'cycle-document',
        frames: {
            a: { ...box, id: 'a', name: 'A', parentFrameId: 'b' },
            b: { ...box, id: 'b', name: 'B', parentFrameId: 'a' }
        }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector', 'Explorer']);
    await explorer(page).getByRole('button', { name: 'A', exact: true }).click();
    await expect(
        page.getByRole('status').filter({ hasText: 'Invalid parent reference' })
    ).toBeVisible();
    const parent = page.getByLabel('Frame parent', { exact: true });
    await expect(parent).toHaveValue('b');
    await parent.selectOption('');
    await expect(parent).toHaveValue('');
    await expect(
        page.getByRole('status').filter({ hasText: 'Invalid parent reference' })
    ).toHaveCount(0);
    await page.reload();
    await explorer(page).getByRole('button', { name: 'A', exact: true }).click();
    await expect(parent).toHaveValue('');
    await expect(
        page.getByRole('status').filter({ hasText: 'Invalid parent reference' })
    ).toHaveCount(0);
});

test('inherits Hide and Lock, explains restrictions, and recovers through Explorer', async ({
    page
}) => {
    const box = {
        position: { x: 100, y: 120 },
        size: { width: 400, height: 300 },
        visible: true,
        locked: false
    };
    const document = createDocument({
        id: 'inherited-document',
        frames: {
            outer: { ...box, id: 'outer', name: 'Outer' },
            inner: {
                ...box,
                id: 'inner',
                name: 'Inner',
                parentFrameId: 'outer',
                position: { x: 200, y: 220 },
                size: { width: 200, height: 150 }
            }
        },
        shapes: {
            artwork: {
                ...createShape({
                    order: 'a0',
                    type: 'rectangle',
                    name: 'Artwork',
                    parentFrameId: 'inner',
                    position: { x: 250, y: 260 },
                    size: { width: 60, height: 40 }
                }),
                id: 'artwork'
            }
        },
        shapesIds: ['artwork']
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector', 'Explorer']);
    const outerRow = explorer(page).getByRole('button', { name: 'Outer', exact: true });
    const innerRow = explorer(page).getByRole('button', { name: 'Inner', exact: true });
    const outerMenu = explorer(page).getByRole('toolbar', { name: 'Outer menu', exact: true });
    const innerMenu = explorer(page).getByRole('toolbar', { name: 'Inner menu', exact: true });
    await expect(artwork(page)).toBeVisible();
    await outerRow.hover();
    await outerMenu.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(frame(page, 'Outer')).toHaveCount(0);
    await expect(frame(page, 'Inner')).toHaveCount(0);
    await expect(artwork(page)).toHaveCount(0);
    await innerRow.click();
    await expect(
        page.getByRole('status').filter({ hasText: 'Hidden by frame Outer' })
    ).toBeVisible();
    await innerRow.hover();
    // The child's own flag remains visible; it was not rewritten to hidden.
    await expect(innerMenu.getByRole('button', { name: 'Hide', exact: true })).toBeEnabled();
    await page.reload();
    await expect(artwork(page)).toHaveCount(0);
    const editorUrl = page.url();
    await page.goto('/documents');
    await expect(page.getByText('Empty canvas', { exact: true })).toBeVisible();
    await page.goto(editorUrl);
    await outerRow.hover();
    await outerMenu.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(artwork(page)).toBeVisible();
    await expect(frame(page, 'Inner')).toBeVisible();
    await outerRow.hover();
    await outerMenu.getByRole('button', { name: 'Lock', exact: true }).click();
    await explorer(page).getByRole('button', { name: 'Artwork', exact: true }).click();
    await expect(page.getByLabel('Name', { exact: true })).not.toBeEditable();
    await expect(page.getByLabel('Selection parent', { exact: true })).toBeDisabled();
    await innerRow.click();
    await expect(page.getByLabel('Frame name', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Frame parent', { exact: true })).toBeDisabled();
    await expect(
        page.getByRole('status').filter({ hasText: 'Locked by frame Outer' })
    ).toBeVisible();
    await innerRow.hover();
    await expect(innerMenu.getByRole('button', { name: 'Lock', exact: true })).toBeDisabled();
    await expect(innerMenu.getByRole('button', { name: 'Hide', exact: true })).toBeDisabled();
    await page.screenshot({ path: '/tmp/reactor-frame-state-normal.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(
        page.getByRole('status').filter({ hasText: 'Locked by frame Outer' })
    ).toBeVisible();
    const hint = page.getByRole('status').filter({ hasText: 'Locked by frame Outer' });
    await expect(hint).toHaveCSS('white-space', 'normal');
    expect(await hint.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/reactor-frame-state-narrow.png' });
    await outerRow.hover();
    await outerMenu.getByRole('button', { name: 'Unlock', exact: true }).click();
    await innerRow.click();
    await expect(page.getByLabel('Frame name', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('Frame parent', { exact: true })).toBeEnabled();
    await expect(page.getByRole('status').filter({ hasText: 'Locked by frame Outer' })).toHaveCount(
        0
    );
});
