import { expect, test, type Locator, type Page } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { automaticLayoutsPrototype } from '../support/automaticScreenLayouts';
import { openEditor } from './support/editor';
import type { Document, InstanceShape } from 'src/app/types';

async function seed(page: Page, document: Document) {
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
}

const row = (page: Page, key: string) => page.locator(`[data-flow-control="${key}"]`);
const screen = (page: Page, id: string) => page.locator(`[data-flow-screen="${id}"]`);
const linkMenu = (page: Page, control: string) =>
    page.getByRole('menu', { name: `Link from ${control}`, exact: true });
const choice = (menu: Locator, name: string) =>
    menu.getByRole('menuitemradio', { name, exact: true });

/** Where a card sits on the board, in the board's own units. */
const place = (card: Locator) =>
    card.evaluate((element) => {
        const matrix = new DOMMatrix(getComputedStyle(element).transform);

        return { x: matrix.e, y: matrix.f };
    });

/** Where a card comes to rest, once it has finished gliding there. */
async function settled(card: Locator) {
    await card.evaluate((element) =>
        Promise.all(element.getAnimations().map((animation) => animation.finished))
    );

    return place(card);
}

test('re-aims and removes links in Flow, reflects them in the Inspector, and arranges only the board', async ({
    page
}) => {
    const document = automaticLayoutsPrototype();
    document.frames.view.position = { x: 400, y: 200 };
    document.frames.desktop = {
        ...document.frames.view,
        id: 'desktop',
        name: 'Desktop',
        position: { x: 1200, y: 200 }
    };
    await seed(page, document);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openEditor(page, ['Inspector']);
    await page.getByRole('button', { name: 'More panels', exact: true }).click();
    const hit = page.locator(
        '#screen-views > [data-screen-view="view"] [data-shape-id="next"] [data-view-instance-hit]'
    );
    await hit.click();
    const geometry = await hit.boundingBox();
    const beforeResources = await page.evaluate(() =>
        performance.getEntriesByType('resource').map((entry) => entry.name)
    );
    expect(beforeResources.some((url) => /\/flow\.[^/]+\.js$/.test(url))).toBe(false);
    await page.getByRole('link', { name: 'Open flow' }).click();
    await expect(page.getByRole('heading', { name: 'Flow', exact: true })).toBeVisible();
    await expect(page.locator('[data-flow-screen]')).toHaveCount(2);
    await expect(page.locator('iframe')).toHaveCount(0);
    const afterResources = await page.evaluate(() =>
        performance.getEntriesByType('resource').map((entry) => entry.name)
    );
    expect(
        afterResources.filter((url) => url.endsWith('.js') && !beforeResources.includes(url)).length
    ).toBeGreaterThan(0);
    await expect(page.getByText('Flow · 2 screens · 2 links')).toBeVisible();
    const next = row(page, 'next');
    await expect(next).toHaveAccessibleName('Continue button');
    await expect(next).toHaveAccessibleDescription('Continue button goes to Details');
    await expect(next).toContainText('→ Details');
    // One click in the menu re-aims the link, as one undo step.
    await next.click();
    await expect(next).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-flow-link="next"]')).toHaveAttribute('data-selected', 'true');
    const menu = linkMenu(page, 'Continue button');
    await expect(choice(menu, 'Details')).toHaveAttribute('aria-checked', 'false');
    await choice(menu, 'Home').click();
    await expect(menu).toHaveCount(0);
    await expect(next).toBeFocused();
    await expect(next).toHaveAccessibleDescription('Continue button goes to Home');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(next).toHaveAccessibleDescription('Continue button goes to Details');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(next).toHaveAccessibleDescription('Continue button goes to Home');
    await next.click();
    await expect(choice(menu, 'Home')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');

    // Arranging moves the card on the board and nothing on the canvas.
    const home = screen(page, 'home');
    const before = await settled(home);
    await page.getByRole('button', { name: 'Arrange Home' }).press('ArrowDown');
    expect(await settled(home)).toEqual({ x: before.x, y: before.y + 20 });
    const details = screen(page, 'details');
    const origin = await settled(details);
    const zoom = Number(await page.locator('[data-flow-board]').getAttribute('data-zoom')) / 100;
    const handle = page.getByRole('button', { name: 'Arrange Details' });
    const location = (await handle.boundingBox())!;
    await page.mouse.move(location.x + 40, location.y + 14);
    await page.mouse.down();
    await page.mouse.move(location.x - 20, location.y + 44, { steps: 3 });
    await page.mouse.up();
    const dropped = await settled(details);
    expect(dropped.x).toBeCloseTo(origin.x - 60 / zoom, 0);
    expect(dropped.y).toBeCloseTo(origin.y + 30 / zoom, 0);
    await page.screenshot({ path: 'test-results/flow.png' });

    await page.getByRole('link', { name: 'Back to canvas' }).click();
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toHaveValue('"home"');
    expect(await hit.boundingBox()).toEqual(geometry);
    await page.getByLabel(/^On (activation|Enter): action$/).selectOption('none');
    await page.getByRole('link', { name: 'Open flow' }).click();
    // A control with no action is not a row; it waits under Add link.
    await expect(row(page, 'wide-next')).toBeVisible();
    await expect(next).toHaveCount(0);
    expect(await settled(home)).toEqual({ x: before.x, y: before.y + 20 });
    await page.getByRole('button', { name: 'Add link on Home', exact: true }).click();
    const add = page.getByRole('menu', { name: 'Add link on Home', exact: true });
    await expect(add.getByRole('menuitem')).toHaveText([
        'Continue button',
        'Name field',
        'Wide input'
    ]);
    await add.getByRole('menuitem', { name: 'Continue button', exact: true }).click();
    await menu.getByRole('menuitemradio', { name: /^Component’s action/ }).click();
    await expect(next).toHaveAccessibleDescription('Continue button goes to Details');
    await page.getByRole('link', { name: 'Back to canvas' }).click();
    await expect(
        page.getByLabel(/^On (activation|Enter): action$/).locator('option:checked')
    ).toHaveText('Source: Details');
    await page.goto('/flow');
    await expect(page.getByRole('heading', { name: 'Flow', exact: true })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
});

test('marks a link to a missing screen and prevents edits to locked controls on direct visits', async ({
    page
}) => {
    const document = automaticLayoutsPrototype();
    document.components.button.interactions = {
        activate: { type: 'navigate', screenId: 'deleted-screen' }
    };
    document.shapes.next.locked = true;
    await seed(page, document);
    await page.goto('/flow');
    const next = row(page, 'next');
    await expect(next).toContainText('→ Missing screen');
    await expect(next).toHaveAccessibleDescription(
        'Continue button goes to a missing screen. The screen it goes to was deleted'
    );
    await next.click();
    const locked = linkMenu(page, 'Continue button');
    await expect(locked.getByText('Locked or view only')).toBeVisible();
    await expect(choice(locked, 'Home')).toBeDisabled();
    await expect(locked.getByRole('menuitem', { name: 'Remove link', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(locked).toHaveCount(0);
    await expect(next).toBeFocused();
    await row(page, 'wide-next').click();
    const open = linkMenu(page, 'Wide continue');
    await expect(choice(open, 'Home')).toBeEnabled();
    await open.getByRole('menuitem', { name: 'Remove link', exact: true }).click();
    await expect(row(page, 'wide-next')).toHaveCount(0);
    // The row is gone, so focus stays on its card.
    await expect(page.getByRole('button', { name: 'Add link on Home', exact: true })).toBeFocused();
    await expect(page.getByText('Flow · 2 screens · 1 link', { exact: true })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
});

test('undoes and redoes with keyboard shortcuts', async ({ page }) => {
    await seed(page, automaticLayoutsPrototype());
    await page.goto('/flow');
    const next = row(page, 'next');
    await next.click();
    await choice(linkMenu(page, 'Continue button'), 'Home').click();
    await expect(next).toHaveAccessibleDescription('Continue button goes to Home');
    await next.focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(next).toHaveAccessibleDescription('Continue button goes to Details');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(next).toHaveAccessibleDescription('Continue button goes to Home');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(next).toHaveAccessibleDescription('Continue button goes to Details');
});

test('marks hidden controls and leaves them out of reachability', async ({ page }) => {
    const document = automaticLayoutsPrototype();
    document.shapes.next.visible = false;
    document.shapes['wide-next'].visible = false;
    await seed(page, document);
    await page.goto('/flow');
    await expect(page.locator('[data-flow-control][data-inactive="true"]')).toHaveCount(2);
    await expect(row(page, 'next')).toHaveAccessibleDescription(
        'Continue button goes to Details. Hidden, so never drawn in Preview'
    );
    await expect(page.locator('[data-flow-link="next"]')).toHaveAttribute('data-inactive', 'true');
    await expect(screen(page, 'details')).toHaveAttribute('data-dim', 'true');
    await expect(page.getByRole('button', { name: 'Arrange Details' })).toHaveAccessibleDescription(
        'Nothing leads here'
    );
});

test('treats a link that starts hidden in prototype as unreachable until something reveals it', async ({
    page
}) => {
    const document = automaticLayoutsPrototype();
    for (const id of ['next', 'wide-next']) {
        (document.shapes[id] as InstanceShape).prototypeVisible = false;
    }
    await seed(page, document);
    await page.goto('/flow');
    const waiting = page
        .locator('[data-flow-control]')
        .filter({ hasText: 'once something shows it' });
    await expect(waiting).toHaveCount(2);
    await expect(page.locator('[data-flow-link="next"]')).toHaveAttribute('data-guarded', 'true');
    await expect(screen(page, 'details')).toHaveAttribute('data-dim', 'true');
    // "Shown" in the same menu is where that is changed.
    await row(page, 'next').click();
    const menu = linkMenu(page, 'Continue button');
    await menu.getByRole('menuitem', { name: /^Shown/ }).click();
    await expect(choice(menu, 'Once something shows it')).toHaveAttribute('aria-checked', 'true');
    await choice(menu, 'Always').click();
    await expect(waiting).toHaveCount(1);
    await expect(screen(page, 'details')).toHaveAttribute('data-dim', 'false');
});

test('keeps the link menu inside a short window and gives focus back to the row', async ({
    page
}) => {
    await seed(page, automaticLayoutsPrototype());
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/flow');
    await row(page, 'wide-next').click();
    const menu = linkMenu(page, 'Wide continue');
    await expect(menu).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(row(page, 'wide-next')).toBeFocused();
});

test('moves no screen that did not need to move when a link changes', async ({ page }) => {
    const document = automaticLayoutsPrototype();
    document.frames.third = { ...document.frames.details, id: 'third', name: 'Third' };
    await seed(page, document);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/flow');
    const [home, details, third] = ['home', 'details', 'third'].map((id) => screen(page, id));
    await expect(third).toHaveAttribute('data-dim', 'true');
    const before = {
        home: await settled(home),
        details: await settled(details),
        third: await settled(third)
    };
    // Opening and closing the menu changes nothing.
    await row(page, 'wide-next').click();
    const menu = linkMenu(page, 'Wide continue');
    await expect(menu).toBeVisible();
    expect(await place(third)).toEqual(before.third);
    // Third gains a link, so it alone moves: beside Details, below it.
    await choice(menu, 'Third').click();
    await expect(third).toHaveAttribute('data-dim', 'false');
    const moved = await settled(third);
    expect(moved.x).toBe(before.details.x);
    expect(moved.y).toBeGreaterThan(before.details.y);
    expect(await place(home)).toEqual(before.home);
    expect(await place(details)).toEqual(before.details);
    // Pointing it back leaves the others where they are again.
    await row(page, 'wide-next').click();
    await choice(menu, 'Details').click();
    await expect(third).toHaveAttribute('data-dim', 'true');
    await settled(third);
    expect(await place(home)).toEqual(before.home);
    expect(await place(details)).toEqual(before.details);
});

for (const width of [1100, 720]) {
    test(`fits the whole board in a ${width}px window, and offers Fit only after zooming`, async ({
        page
    }) => {
        const document = automaticLayoutsPrototype();
        document.frames.third = { ...document.frames.details, id: 'third', name: 'Third' };
        await seed(page, document);
        await page.setViewportSize({ width, height: 800 });
        await page.goto('/flow');
        const board = page.locator('[data-flow-board]');
        const fit = page.getByRole('button', { name: 'Fit', exact: true });
        const inside = async () => {
            const frame = (await board.boundingBox())!;
            for (const card of await page.locator('[data-flow-screen]').all()) {
                const box = (await card.boundingBox())!;
                if (
                    box.x < frame.x ||
                    box.y < frame.y ||
                    box.x + box.width > frame.x + frame.width ||
                    box.y + box.height > frame.y + frame.height
                ) {
                    return false;
                }
            }

            return true;
        };
        await expect(page.locator('[data-flow-screen]')).toHaveCount(3);
        expect(await inside()).toBe(true);
        // Fitting keeps the map clear of the toolbar floating over the board.
        const bar = (await page.locator('main > header').boundingBox())!;
        for (const card of await page.locator('[data-flow-screen]').all()) {
            expect((await card.boundingBox())!.y).toBeGreaterThanOrEqual(bar.y + bar.height);
        }
        // Cards are labelled groups, not landmarks.
        expect(await page.locator('main').ariaSnapshot()).not.toContain('region');
        await expect(fit).toHaveCount(0);
        const fittedZoom = await board.getAttribute('data-zoom');
        await page.mouse.move(width / 2, 400);
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, -400);
        await page.keyboard.up('Control');
        await expect(board).not.toHaveAttribute('data-zoom', fittedZoom!);
        await fit.click();
        await expect(board).toHaveAttribute('data-zoom', fittedZoom!);
        await expect(fit).toHaveCount(0);
        expect(await inside()).toBe(true);
        // Dragging empty board pans, and Ctrl/⌘ 0 brings it back.
        const first = (await screen(page, 'home').boundingBox())!;
        await page.mouse.move(width - 30, 700);
        await page.mouse.down();
        await page.mouse.move(width - 90, 660, { steps: 3 });
        await page.mouse.up();
        expect((await screen(page, 'home').boundingBox())!.x).toBeCloseTo(first.x - 60, 0);
        await expect(fit).toBeVisible();
        await page.keyboard.press('ControlOrMeta+0');
        await expect(fit).toHaveCount(0);
        expect((await screen(page, 'home').boundingBox())!.x).toBeCloseTo(first.x, 0);
    });
}

test('describes controls whose imported IDs contain spaces, and opens their menu from the keyboard', async ({
    page
}) => {
    const document = automaticLayoutsPrototype();
    document.shapes['next control'] = { ...document.shapes.next, id: 'next control' };
    delete document.shapes.next;
    document.shapesIds = document.shapesIds.map((id) => (id === 'next' ? 'next control' : id));
    await seed(page, document);
    await page.goto('/flow');
    const control = row(page, 'next control');
    await expect(control).toHaveAccessibleName('Continue button');
    await expect(control).toHaveAccessibleDescription('Continue button goes to Details');
    await control.press('Enter');
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await expect(linkMenu(page, 'Continue button')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(control).toBeFocused();
    // ↑ and ↓ walk the card's rows, down to Add link.
    const rows = screen(page, 'home').locator('li > button');
    await expect(rows).toHaveCount(3);
    await rows.nth(0).focus();
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('button', { name: 'Add link on Home', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(rows.nth(1)).toBeFocused();
});

test('keeps the start screen with the document, for Flow and the player alike', async ({
    page
}) => {
    await seed(page, automaticLayoutsPrototype());
    await page.goto('/flow');
    await expect(screen(page, 'home').getByText('Start', { exact: true })).toBeVisible();
    await expect(page.locator('[data-flow-start="home"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'More for Details', exact: true }).click();
    const menu = page.getByRole('menu', { name: 'Screen Details', exact: true });
    await choice(menu, 'Start here').click();
    await expect(screen(page, 'details').getByText('Start', { exact: true })).toBeVisible();
    await expect(page.locator('[data-flow-start="details"]')).toHaveCount(1);
    await expect(screen(page, 'home')).toHaveAttribute('data-dim', 'true');
    // The same menu opens from a right-click, and Play follows the start screen.
    await page.getByRole('button', { name: 'Arrange Details' }).click({ button: 'right' });
    await expect(choice(menu, 'Start here')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await page.goto('/flow');
    await expect(screen(page, 'details').getByText('Start', { exact: true })).toBeVisible();
    await page.goto('/prototype');
    await expect(page.getByLabel('Preview screen')).toHaveValue('details');
});

test('draws a picture of every screen and outlines the selected control on it', async ({
    page
}) => {
    await seed(page, automaticLayoutsPrototype());
    await page.goto('/flow');
    await expect(page.locator('[data-flow-screen]')).toHaveCount(2);
    for (const name of ['Home', 'Details']) {
        await expect(
            page.getByRole('img', { name: `Picture of ${name}`, exact: true })
        ).toBeVisible();
    }
    const picture = screen(page, 'home').getByRole('img');
    const box = (await picture.boundingBox())!;
    expect(Math.round((box.height / box.width) * 264)).toBe(170);
    await expect(page.locator('[data-thumbnail-outline]')).toHaveCount(0);
    await row(page, 'next').click();
    await expect(screen(page, 'home').locator('[data-thumbnail-outline]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    // Selecting a screen highlights its links in and out.
    await page.getByRole('button', { name: 'Select Details', exact: true }).click();
    await expect(screen(page, 'details')).toHaveAttribute('data-selected', 'true');
    await expect(page.locator('[data-flow-link][data-selected="true"]')).toHaveCount(2);
});

test('sets what a control shows or hides, and that it starts hidden, in one menu', async ({
    page
}) => {
    await seed(page, automaticLayoutsPrototype());
    await page.goto('/flow');
    const next = row(page, 'next');
    await next.click();
    const menu = linkMenu(page, 'Continue button');
    await menu.getByRole('menuitem', { name: /^On this screen/ }).click();
    await expect(menu.getByText('Show or hide', { exact: true })).toBeVisible();
    await choice(menu, 'Name field').click();
    await expect(next).toHaveAccessibleDescription('Continue button shows or hides Name field');
    await expect(page.locator('[data-flow-link="next"]')).toHaveCount(0);
    await next.click();
    await menu.getByRole('menuitem', { name: /^On this screen/ }).click();
    const hidden = choice(menu, 'Name field starts hidden');
    await expect(hidden).toHaveAttribute('aria-checked', 'false');
    await hidden.click();
    await next.click();
    await menu.getByRole('menuitem', { name: /^On this screen/ }).click();
    await expect(hidden).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    // The target itself now starts hidden: its own "Shown" says so.
    await page.getByRole('button', { name: 'Add link on Home', exact: true }).click();
    await page
        .getByRole('menu', { name: 'Add link on Home', exact: true })
        .getByRole('menuitem', { name: 'Name field', exact: true })
        .click();
    const target = linkMenu(page, 'Name field');
    await target.getByRole('menuitem', { name: /^Shown/ }).click();
    await expect(choice(target, 'Once something shows it')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    // Two edits, two undo steps.
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(next).toHaveAccessibleDescription('Continue button goes to Details');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});

test('adds a named state from the menu and makes the control switch it', async ({ page }) => {
    await seed(page, automaticLayoutsPrototype());
    await page.goto('/flow');
    const next = row(page, 'next');
    await next.click();
    const menu = linkMenu(page, 'Continue button');
    await menu.getByRole('menuitem', { name: /^On this screen/ }).click();
    await menu.getByRole('menuitem', { name: 'New state…', exact: true }).click();
    const form = page.getByRole('form', { name: 'New state' });
    await expect(form.getByRole('textbox')).toBeFocused();
    await form.getByRole('textbox').fill('Help is open');
    await form.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(next).toHaveAccessibleDescription('Continue button switches Help is open');
    // The new state and the switch are one step: one Undo takes back both.
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(next).toHaveAccessibleDescription('Continue button goes to Details');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(next).toHaveAccessibleDescription('Continue button switches Help is open');
    // The other control can now be shown only while that state is on.
    await row(page, 'wide-next').click();
    const other = linkMenu(page, 'Wide continue');
    await other.getByRole('menuitem', { name: /^Shown/ }).click();
    await choice(other, 'When Help is open is on').click();
    await expect(row(page, 'wide-next')).toHaveAccessibleDescription(
        'Wide continue goes to Details, if Help is open is on'
    );
    await expect(page.locator('[data-flow-link="wide-next"]')).toHaveAttribute(
        'data-guarded',
        'true'
    );
});

for (const name of ['List / detail', 'Forms', 'Sign-in', 'Settings', 'Inspector typography']) {
    test(`draws ${name} with a picture per screen and no link across a card`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/documents');
        await page.getByRole('button', { name: 'Templates', exact: true }).click();
        await page.getByRole('button', { name: `Use ${name} template`, exact: true }).click();
        await page.locator('#screen-views > g').first().waitFor();
        await page.goto('/flow');
        const cards = page.locator('[data-flow-screen]');
        await expect(cards).toHaveCount(name === 'Inspector typography' ? 1 : 3);
        await expect(page.locator('[data-flow-screen] svg[role="img"]')).toHaveCount(
            await cards.count()
        );
        await expect(page.locator('[data-flow-start]')).toHaveCount(1);
        const goes = await page.locator('[data-flow-control]').filter({ hasText: '→' }).count();
        await expect(page.locator('[data-flow-link]')).toHaveCount(
            name === 'Inspector typography' ? 0 : goes
        );
        // Walk each line in small steps: no point of it may lie inside a card.
        const crossings = await page.evaluate(() => {
            const boxes = [...document.querySelectorAll('[data-flow-screen]')].map((card) =>
                card.getBoundingClientRect()
            );
            let count = 0;
            for (const path of document.querySelectorAll<SVGPathElement>('[data-flow-link]')) {
                const matrix = path.getScreenCTM()!;
                const length = path.getTotalLength();
                for (let at = 0; at <= length; at += 2) {
                    const point = path.getPointAtLength(at).matrixTransform(matrix);
                    if (
                        boxes.some(
                            (box) =>
                                point.x > box.left + 1 &&
                                point.x < box.right - 1 &&
                                point.y > box.top + 1 &&
                                point.y < box.bottom - 1
                        )
                    ) {
                        count++;
                    }
                }
            }

            return count;
        });
        expect(crossings).toBe(0);
        const slug = name.replace(/[^a-z]+/gi, '-').toLowerCase();
        await page.screenshot({ path: `test-results/flow-${slug}.png` });
    });
}

test('zooms with two fingers on a touch screen, starting on a card or on empty board', async ({
    page
}) => {
    await seed(page, automaticLayoutsPrototype());
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto('/flow');
    const board = page.locator('[data-flow-board]');
    await expect(screen(page, 'home')).toBeVisible();
    const before = Number(await board.getAttribute('data-zoom'));
    const thumb = (await page.getByRole('button', { name: 'Select Home' }).boundingBox())!;
    // One finger on a card's picture, one on empty board, spreading apart.
    await page.evaluate(
        ({ from }) => {
            const send = (type: string, id: number, x: number, y: number) => {
                const target =
                    (type === 'pointerdown' ? document.elementFromPoint(x, y) : null) ??
                    document.querySelector('[data-flow-board]')!;
                target.dispatchEvent(
                    new PointerEvent(type, {
                        pointerId: id,
                        pointerType: 'touch',
                        isPrimary: id === 1,
                        clientX: x,
                        clientY: y,
                        bubbles: true
                    })
                );
            };
            send('pointerdown', 1, from.x, from.y);
            send('pointerdown', 2, from.x + 100, from.y);
            for (let step = 1; step <= 10; step++) {
                send('pointermove', 1, from.x - step * 10, from.y);
                send('pointermove', 2, from.x + 100 + step * 10, from.y);
            }
            send('pointerup', 1, from.x - 100, from.y);
            send('pointerup', 2, from.x + 200, from.y);
        },
        { from: { x: thumb.x + 40, y: thumb.y + 40 } }
    );
    // 100 px apart became 300 px apart.
    await expect
        .poll(async () => Number(await board.getAttribute('data-zoom')))
        .toBeGreaterThanOrEqual(Math.min(200, before * 3) - 1);
    expect(Number(await board.getAttribute('data-zoom'))).toBeLessThanOrEqual(
        Math.min(200, before * 3) + 1
    );
    await expect(page.getByRole('button', { name: 'Fit', exact: true })).toBeVisible();
});
