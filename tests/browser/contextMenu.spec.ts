import { expect, test } from '@playwright/test';
import { createDocument, createGroup, createLayer, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

test('a press outside the context menu closes it, and does nothing else', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const menu = page.locator('[data-cy="context-menu"]');
    const drawShape = menu.getByRole('menuitem', { name: 'Draw shape' });
    const handles = page.locator('svg#surface [data-handle]');

    await page.mouse.click(surface.x + 500, surface.y + 300, { button: 'right' });
    await expect(menu).toBeVisible();
    await expect(handles).toHaveCount(13);

    // On the canvas: the menu closes, and the press neither deselects nor draws.
    await page.mouse.click(surface.x + 700, surface.y + 500);
    await expect(menu).toBeHidden();
    await expect(handles).toHaveCount(13);
    await expect(shapes(page)).toHaveCount(1);

    // On a panel: the menu closes too.
    await page.mouse.click(surface.x + 500, surface.y + 300, { button: 'right' });
    await expect(menu).toBeVisible();
    await page.getByText('Saved', { exact: true }).click();
    await expect(menu).toBeHidden();

    // A press on a menu action still picks its tool.
    await page.mouse.click(surface.x + 500, surface.y + 300, { button: 'right' });
    await drawShape.click();
    await menu.getByRole('menuitem', { name: 'Circle' }).click();
    await expect(
        page.getByRole('list', { name: 'Tools' }).getByRole('button', { pressed: true })
    ).toHaveAttribute('title', 'Draws a circle shape');
});

test('right-clicking a shape offers actions for that shape', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const menu = page.locator('[data-cy="context-menu"]');

    await page.mouse.click(surface.x + 320, surface.y + 120, { button: 'right' });
    await expect(menu).toHaveAttribute('aria-label', 'rectangle-1 actions');
    await expect(menu.getByRole('menuitem', { name: 'Create component' })).toBeEnabled();

    // Shortcuts come from the commands, labeled for this platform.
    const mac = await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.userAgent));

    await expect(menu.getByRole('menuitem', { name: 'Clone' })).toContainText(
        mac ? '⌘D' : 'Ctrl+D'
    );
    await expect(menu.getByRole('menuitem', { name: 'Create component' })).toContainText(
        mac ? '⌥⌘C' : 'Ctrl+Alt+C'
    );
    await menu.getByRole('menuitem', { name: 'Clone' }).click();
    await expect(shapes(page)).toHaveCount(2);
    await expect(menu).toBeHidden();
});

test('a shape can be renamed from its context menu header', async ({ page }) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    const surface = (await page.locator('svg#surface').boundingBox())!;
    const menu = page.locator('[data-cy="context-menu"]');

    await page.mouse.click(surface.x + 320, surface.y + 120, { button: 'right' });
    await menu.getByRole('button', { name: 'Rename rectangle' }).click();
    await menu.getByRole('textbox', { name: 'Name' }).fill('Card background');
    await menu.getByRole('textbox', { name: 'Name' }).press('Enter');

    await expect(menu).toHaveAttribute('aria-label', 'Card background actions');
    await expect(
        page.getByRole('region', { name: 'Explorer' }).getByRole('button', {
            name: 'Card background',
            exact: true
        })
    ).toBeVisible();
});

test('a group can be renamed from its context menu header', async ({ page }) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await pointer(page, 'pointerdown', { x: 280, y: 80 });
    await pointer(page, 'pointermove', { x: 460, y: 160 });
    await pointer(page, 'pointerup', { x: 460, y: 160 });
    await page.keyboard.press('ControlOrMeta+g');

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const menu = page.locator('[data-cy="context-menu"]');
    await page.mouse.click(surface.x + 320, surface.y + 120, { button: 'right' });
    await expect(menu).toHaveAttribute('aria-label', 'group-1 actions');
    // A group's commands come from the registry, as its own menus' do.
    await expect(menu.getByRole('menuitem', { name: 'Ungroup' })).toBeEnabled();
    await menu.getByRole('button', { name: 'Rename group' }).click();
    await menu.getByRole('textbox', { name: 'Name' }).fill('Card parts');
    await menu.getByRole('textbox', { name: 'Name' }).press('Enter');

    await expect(menu).toHaveAttribute('aria-label', 'Card parts actions');
    await expect(
        page.getByRole('region', { name: 'Explorer' }).getByRole('button', {
            name: 'Card parts',
            exact: true
        })
    ).toBeVisible();
});

test('a mixed selection does not offer to rename its selected group', async ({ page }) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 100 }, { x: 440, y: 140 });
    await drawRect(page, { x: 500, y: 100 }, { x: 540, y: 140 });
    await pointer(page, 'pointerdown', { x: 280, y: 80 });
    await pointer(page, 'pointermove', { x: 460, y: 160 });
    await pointer(page, 'pointerup', { x: 460, y: 160 });
    await page.keyboard.press('ControlOrMeta+g');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'rectangle-3', exact: true })
        .click({ modifiers: ['Shift'] });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const menu = page.locator('[data-cy="context-menu"]');
    await page.mouse.click(surface.x + 320, surface.y + 120, { button: 'right' });

    await expect(menu).toHaveAttribute('aria-label', '3 selected actions');
    await expect(menu.getByRole('button', { name: 'Rename group' })).toHaveCount(0);
    await expect(menu.locator('svg[data-object-type="selection"]')).toHaveCount(1);
    await expect(menu.getByRole('menuitem', { name: /^Group/ })).toBeVisible();
});

test('moving a group also moves its hidden member', async ({ page }) => {
    const visible = createShape({
        type: 'rectangle',
        name: 'Visible',
        order: 'a0',
        position: { x: 300, y: 100 },
        size: { width: 40, height: 40 }
    });
    const hidden = createShape({
        type: 'rectangle',
        name: 'Hidden',
        order: 'a1',
        position: { x: 400, y: 100 },
        size: { width: 40, height: 40 },
        visible: false
    });
    const group = createGroup({ name: 'Pair', shapesIds: [visible.id, hidden.id] });
    const layer = createLayer({ name: 'Target' });
    const document = createDocument({
        shapes: { [visible.id]: visible, [hidden.id]: hidden },
        groups: { [group.id]: group },
        layers: { [layer.id]: layer }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Explorer']);

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const menu = page.locator('[data-cy="context-menu"]');
    await page.mouse.click(surface.x + 320, surface.y + 120, { button: 'right' });
    await expect(menu).toHaveAttribute('aria-label', 'Pair actions');
    await menu.getByRole('menuitem', { name: 'Move to layer' }).click();
    await expect(menu.getByRole('menuitem', { name: 'Canvas', exact: true })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Target' }).click();

    const explorer = page.getByRole('region', { name: 'Explorer' });
    const targetLayer = explorer
        .getByRole('button', { name: 'Target', exact: true })
        .locator('xpath=ancestor::li[1]');
    await expect(targetLayer.getByRole('button', { name: 'Pair', exact: true })).toBeVisible();
    await expect(targetLayer.getByRole('button', { name: 'Hidden', exact: true })).toBeVisible();
});

test('a component instance can be renamed from its context menu header', async ({ page }) => {
    await openEditor(page, ['Explorer']);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    const explorer = page.getByRole('region', { name: 'Explorer' });
    await explorer.getByRole('button', { name: 'Create component', exact: true }).click();

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const menu = page.locator('[data-cy="context-menu"]');
    await page.mouse.click(surface.x + 320, surface.y + 120, { button: 'right' });
    await expect(menu).toHaveAttribute('aria-label', 'component-1 actions');
    await expect(menu.getByRole('menuitem', { name: 'Detach instance' })).toBeEnabled();

    await menu.getByRole('button', { name: 'Rename instance' }).click();
    const name = menu.getByRole('textbox', { name: 'Name' });
    await expect(name).toBeFocused();
    await name.fill('Discarded');
    await name.press('Escape');
    await expect(menu.getByRole('button', { name: 'component-1', exact: true })).toBeVisible();

    await menu.getByRole('button', { name: 'component-1', exact: true }).click();
    await name.fill('Card');
    await name.press('Enter');
    await expect(name).toHaveCount(0);
    await expect(menu).toHaveAttribute('aria-label', 'Card actions');
    await expect(explorer.getByRole('button', { name: 'Card', exact: true })).toBeVisible();
});

test('Escape dismisses the menu and it stays in the viewport', async ({ page }) => {
    await openEditor(page);
    const surface = (await page.locator('svg#surface').boundingBox())!;
    await page.mouse.click(surface.x + 500, surface.y + 300, { button: 'right' });

    const menu = page.locator('[data-cy="context-menu"]');
    await expect(menu).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await expect(menu.getByRole('menuitem', { name: 'Circle' })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(menu.getByRole('menuitem', { name: 'Draw shape' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // Tab leaves the menu too.
    await page.mouse.click(surface.x + 500, surface.y + 300, { button: 'right' });
    await expect(menu).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(menu).toBeHidden();

    await page.locator('svg#surface').evaluate(
        (element, { x, y }) => {
            element.dispatchEvent(
                new MouseEvent('contextmenu', {
                    clientX: x,
                    clientY: y,
                    bubbles: true,
                    cancelable: true
                })
            );
        },
        { x: surface.x + surface.width - 12, y: surface.y + surface.height - 12 }
    );
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
});

test('a selection can be aligned and its clipboard used from its context menu', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });
    await drawRect(page, { x: 400, y: 200 }, { x: 440, y: 240 });
    await pointer(page, 'pointerdown', { x: 280, y: 80 });
    await pointer(page, 'pointermove', { x: 460, y: 260 });
    await pointer(page, 'pointerup', { x: 460, y: 260 });

    const surface = (await page.locator('svg#surface').boundingBox())!;
    const menu = page.locator('[data-cy="context-menu"]');
    await page.mouse.click(surface.x + 320, surface.y + 120, { button: 'right' });
    await expect(menu.getByRole('menuitem', { name: /^Cut/ })).toBeEnabled();
    await expect(menu.getByRole('menuitem', { name: /^Copy/ })).toBeEnabled();
    await expect(menu.getByRole('menuitem', { name: 'Remove from group' })).toHaveCount(0);

    await menu.getByRole('menuitem', { name: 'Align', exact: true }).click();
    await menu.getByRole('menuitem', { name: /^Align left/ }).click();
    await expect(menu).toBeHidden();
    const [first, second] = await Promise.all([
        shapes(page).nth(0).boundingBox(),
        shapes(page).nth(1).boundingBox()
    ]);
    expect(second!.x).toBeCloseTo(first!.x, 0);
});

test('the canvas menu zooms and shows the rulers', async ({ page }) => {
    await openEditor(page);
    const surface = (await page.locator('svg#surface').boundingBox())!;
    const menu = page.locator('[data-cy="context-menu"]');
    const camera = page.locator('svg#surface #camera');

    await page.mouse.click(surface.x + 500, surface.y + 300, { button: 'right' });
    await menu.getByRole('menuitem', { name: /^Zoom in/ }).click();
    await expect(camera).toHaveAttribute('transform', /scale\(1\.1\)/);

    await page.mouse.click(surface.x + 500, surface.y + 300, { button: 'right' });
    await expect(menu.getByRole('menuitem', { name: /^Align/ })).toHaveCount(0);
    await menu.getByRole('menuitemcheckbox', { name: 'Show rulers' }).click();
    await expect(page.locator('svg#surface [data-ruler="top"]')).toBeVisible();
});

test.describe('with the clipboard', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

    test('copies, cuts and pastes where the menu was opened', async ({ page }) => {
        await openEditor(page);
        await drawRect(page, { x: 300, y: 100 }, { x: 340, y: 140 });

        const surface = (await page.locator('svg#surface').boundingBox())!;
        const menu = page.locator('[data-cy="context-menu"]');
        const openAt = (x: number, y: number) =>
            page.mouse.click(surface.x + x, surface.y + y, { button: 'right' });
        const copied = shapes(page).nth(0).locator('rect[data-cy]');
        const pasted = shapes(page).nth(1).locator('rect[data-cy]');
        const placeOf = async (rect: typeof pasted) => ({
            x: Number(await rect.getAttribute('x')),
            y: Number(await rect.getAttribute('y'))
        });

        await openAt(320, 120);
        await menu.getByRole('menuitem', { name: /^Copy/ }).click();

        // On a shape, the paste is centered where the menu was opened, over that shape.
        await openAt(320, 120);
        await menu.getByRole('menuitem', { name: /^Paste/ }).click();
        await expect(shapes(page)).toHaveCount(2);
        const [original, first] = [await placeOf(copied), await placeOf(pasted)];
        expect(Math.abs(first.x - original.x)).toBeLessThan(20);
        expect(Math.abs(first.y - original.y)).toBeLessThan(20);

        await openAt(320, 120);
        await menu.getByRole('menuitem', { name: /^Cut/ }).click();
        await expect(shapes(page)).toHaveCount(1);

        await openAt(500, 300);
        await menu.getByRole('menuitem', { name: /^Paste/ }).click();
        await expect(shapes(page)).toHaveCount(2);
        await expect(pasted).toHaveAttribute('x', '480');
        await expect(pasted).toHaveAttribute('y', '280');
    });
});
