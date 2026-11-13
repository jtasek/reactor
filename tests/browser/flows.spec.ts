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
    // Plain arrows are for moving between rows; Alt/⌥ with an arrow moves the card.
    await page.getByRole('button', { name: 'Arrange Home' }).press('ArrowDown');
    expect(await settled(home)).toEqual(before);
    await page.getByRole('button', { name: 'Arrange Home' }).press('Alt+ArrowDown');
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
        "Nothing leads here No links. Down arrow moves to the screen's menu and links."
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

/** The middle of an element, for the mouse. */
async function middle(target: Locator) {
    const box = (await target.boundingBox())!;

    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function threeScreens() {
    const document = automaticLayoutsPrototype();
    document.frames.third = { ...document.frames.details, id: 'third', name: 'Third' };

    return document;
}

test('links a control by dragging it from the picture onto a screen, and Esc cancels', async ({
    page
}) => {
    await seed(page, threeScreens());
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/flow');
    const next = row(page, 'next');
    await expect(next).toHaveAccessibleDescription('Continue button goes to Details');
    const control = screen(page, 'home').locator('[data-thumbnail-control="next"]');
    const from = await middle(control);
    const third = await middle(page.getByRole('button', { name: 'Select Third', exact: true }));
    // Under the pointer the control is outlined, as something to pick up.
    await page.mouse.move(from.x, from.y);
    await expect(control).toHaveCSS('stroke', 'rgb(26, 93, 219)');
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y + 10, { steps: 2 });
    await expect(page.locator('[data-flow-live]')).toHaveCount(1);
    // Every screen offers itself; the one under the pointer, still Home, more strongly.
    await expect(page.locator('[data-flow-screen][data-drop="can"]')).toHaveCount(2);
    await expect(screen(page, 'home')).toHaveAttribute('data-drop', 'over');
    await page.mouse.move(third.x, third.y, { steps: 4 });
    await expect(screen(page, 'third')).toHaveAttribute('data-drop', 'over');
    await page.mouse.up();
    await expect(page.locator('[data-flow-live]')).toHaveCount(0);
    await expect(page.locator('[data-flow-screen][data-drop]')).toHaveCount(0);
    await expect(next).toHaveAccessibleDescription('Continue button goes to Third');
    await expect(next).toHaveAttribute('aria-pressed', 'true');
    // The drop is one undo step, and does not count as a click on either screen.
    await expect(page.locator('[data-flow-screen][data-selected="true"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(next).toHaveAccessibleDescription('Continue button goes to Details');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();

    // Esc while dragging, or letting go over empty board, changes nothing.
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(third.x, third.y, { steps: 4 });
    await expect(page.locator('[data-flow-live]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-flow-live]')).toHaveCount(0);
    await page.mouse.up();
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 200, from.y + 500, { steps: 4 });
    await expect(page.locator('[data-flow-live]')).toHaveCount(1);
    await page.mouse.up();
    await expect(page.locator('[data-flow-live]')).toHaveCount(0);
    await expect(next).toHaveAccessibleDescription('Continue button goes to Details');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();

    // A control with no action yet gains its first link the same way.
    const field = await middle(screen(page, 'home').locator('[data-thumbnail-control="name"]'));
    await page.mouse.move(field.x, field.y);
    await page.mouse.down();
    await page.mouse.move(third.x, third.y, { steps: 4 });
    await page.mouse.up();
    await expect(row(page, 'name')).toHaveAccessibleDescription(
        'Enter in Name field goes to Third'
    );
});

test('re-aims a link by dragging its dot onto another screen', async ({ page }) => {
    await seed(page, threeScreens());
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/flow');
    const dot = page.locator('[data-flow-dot="wide-next"]');
    await expect(dot).toHaveAttribute('data-draggable', 'true');
    const from = await middle(dot);
    const third = await middle(page.getByRole('button', { name: 'Arrange Third' }));
    // A press a few pixels off the 9 px dot still takes hold of it.
    await page.mouse.move(from.x + 8, from.y - 8);
    await page.mouse.down();
    await page.mouse.move(third.x, third.y, { steps: 4 });
    await expect(screen(page, 'third')).toHaveAttribute('data-drop', 'over');
    await page.mouse.up();
    await expect(row(page, 'wide-next')).toHaveAccessibleDescription('Wide continue goes to Third');
    await expect(page.locator('[data-flow-link="wide-next"]')).toHaveAttribute(
        'data-selected',
        'true'
    );
});

test('offers no dragging to link in a locked document', async ({ page }) => {
    const document = threeScreens();
    document.locked = true;
    await seed(page, document);
    await page.goto('/flow');
    await expect(row(page, 'next')).toBeVisible();
    await expect(page.locator('[data-thumbnail-control]')).toHaveCount(0);
    await expect(page.locator('[data-flow-dot="next"]')).toHaveAttribute('data-draggable', 'false');
});

test('keeps a dragged screen where it was put when links change, until Tidy up', async ({
    page
}) => {
    await seed(page, threeScreens());
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/flow');
    const third = screen(page, 'third');
    const automatic = await settled(third);
    const board = page.locator('[data-flow-board]');
    const empty = { x: 60, y: 900 };
    // Nothing was moved, so the board's own menu has nothing to offer.
    await page.mouse.click(empty.x, empty.y, { button: 'right' });
    await expect(page.getByRole('menu', { name: 'Board', exact: true })).toHaveCount(0);
    // Dragging by the picture, away from any control, moves the card.
    const picture = (await page
        .getByRole('button', { name: 'Select Third', exact: true })
        .boundingBox())!;
    const zoom = Number(await board.getAttribute('data-zoom')) / 100;
    await page.mouse.move(picture.x + 6, picture.y + 6);
    await page.mouse.down();
    await page.mouse.move(picture.x + 66, picture.y - 34, { steps: 3 });
    await page.mouse.up();
    const put = await settled(third);
    expect(put.x).toBeCloseTo(automatic.x + 60 / zoom, 0);
    expect(put.y).toBeCloseTo(automatic.y - 40 / zoom, 0);
    await expect(third).toHaveAttribute('data-selected', 'false');
    // A link to it changes its column underneath; the card does not move.
    await row(page, 'wide-next').click();
    await choice(linkMenu(page, 'Wide continue'), 'Third').click();
    await expect(third).toHaveAttribute('data-dim', 'false');
    const after = await settled(third);
    expect(after.x).toBeCloseTo(put.x, 0);
    expect(after.y).toBeCloseTo(put.y, 0);
    await page.goto('/flow');
    const reloaded = await settled(third);
    expect(reloaded.x).toBeCloseTo(put.x, 0);
    expect(reloaded.y).toBeCloseTo(put.y, 0);
    // Tidy up puts every screen back in the automatic layout, and then has nothing left to do.
    await page.mouse.click(empty.x, empty.y, { button: 'right' });
    await page
        .getByRole('menu', { name: 'Board', exact: true })
        .getByRole('menuitem', { name: 'Tidy up', exact: true })
        .click();
    const tidied = await settled(third);
    expect(tidied.x).toBe((await settled(screen(page, 'details'))).x);
    expect(tidied.y).toBeGreaterThan((await place(screen(page, 'details'))).y);
    await page.mouse.click(empty.x, empty.y, { button: 'right' });
    await expect(page.getByRole('menu', { name: 'Board', exact: true })).toHaveCount(0);
});

const check = (page: Page) => page.locator('[data-flow-check]');

test('counts a broken link as a problem, lists an end screen as a note, and offers the fix', async ({
    page
}) => {
    const document = automaticLayoutsPrototype();
    (document.shapes.next as InstanceShape).interactions = {
        activate: { type: 'navigate', screenId: 'deleted-screen' }
    };
    await seed(page, document);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/flow');
    await expect(check(page)).toHaveAccessibleName('1 problem');
    await expect(check(page)).toHaveText('1problem');
    await check(page).click();
    const panel = page.getByRole('dialog', { name: 'Check', exact: true });
    await expect(panel.locator('[data-flow-remark="problem"]')).toHaveText(
        '“Continue button” on Home: the screen it goes to was deleted.Pick another screen'
    );
    // Where the flow ends is worth knowing, and is not counted.
    await expect(panel.locator('[data-flow-remark="note"]')).toHaveText('Details ends the flow.');
    // A remark selects what it is about and puts the keyboard there.
    await panel.getByRole('button', { name: 'Details ends the flow.', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(screen(page, 'details')).toHaveAttribute('data-selected', 'true');
    await expect(page.getByRole('button', { name: 'Arrange Details', exact: true })).toBeFocused();
    // The fix opens the link's own menu; one choice there clears the problem.
    await check(page).click();
    await panel.getByRole('button', { name: 'Pick another screen', exact: true }).click();
    await expect(row(page, 'next')).toHaveAttribute('aria-pressed', 'true');
    await choice(linkMenu(page, 'Continue button'), 'Details').click();
    await expect(check(page)).toHaveAccessibleName('No problems');
    await expect(check(page)).toHaveText('No problems');
    await expect(page.locator('[data-flow-announce]')).toHaveText(
        'Link changed: Continue button goes to Details'
    );
    // The popover also says where the prototype starts, and changes it.
    await check(page).click();
    const start = panel.getByRole('combobox', { name: 'Start screen', exact: true });
    await expect(start).toHaveValue('home');
    await start.selectOption('details');
    await expect(page.locator('[data-flow-start]')).toHaveAttribute('data-flow-start', 'details');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(check(page)).toBeFocused();
});

test('pans to a screen that Check points at when it is out of view', async ({ page }) => {
    await seed(page, threeScreens());
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.goto('/flow');
    const third = screen(page, 'third');
    await expect(third).toBeVisible();
    // Zoomed in on the top-left corner, Third is off the window.
    await page.mouse.move(120, 200);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -600);
    await page.keyboard.up('Control');
    await expect(third).not.toBeInViewport({ ratio: 0.99 });
    await check(page).click();
    await page
        .getByRole('dialog', { name: 'Check', exact: true })
        .getByRole('button', { name: 'Nothing leads to Third.', exact: true })
        .click();
    await expect(third).toHaveAttribute('data-selected', 'true');
    await expect(page.getByRole('button', { name: 'Select Third', exact: true })).toBeInViewport({
        ratio: 0.99
    });
});

test('shows the flow as a list below 700px, with menus as bottom sheets', async ({ page }) => {
    await seed(page, automaticLayoutsPrototype());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/flow');
    const list = page.locator('[data-flow-list]');
    await expect(list).toBeVisible();
    await expect(page.locator('[data-flow-board]')).toHaveCount(0);
    // One group per screen in the map's order; each link reads as a sentence.
    await expect(list.getByRole('group')).toHaveCount(2);
    await expect(list.getByRole('group').first()).toHaveAccessibleName('Screen Home');
    const next = row(page, 'next');
    await expect(next).toHaveText('Continue button goes to Details');
    await expect(next).toHaveAccessibleName('Continue button');
    await expect(next).toHaveAccessibleDescription('Continue button goes to Details');
    const rows = screen(page, 'home').locator('li > button');
    await expect(rows.last()).toHaveText('Add link');
    for (const item of await rows.all()) {
        expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    // The menu is a sheet along the bottom edge, as wide as the window.
    await next.click();
    const menu = linkMenu(page, 'Continue button');
    const sheet = (await menu.boundingBox())!;
    expect(sheet.x).toBe(0);
    expect(sheet.width).toBe(390);
    expect(sheet.y + sheet.height).toBe(844);
    expect((await choice(menu, 'Home').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await choice(menu, 'Home').click();
    await expect(next).toHaveText('Continue button goes to Home');
    await expect(next).toBeFocused();
    // Check works here too, and its remark scrolls the list.
    await expect(check(page)).toHaveAccessibleName('No problems');
    await check(page).click();
    await page
        .getByRole('dialog', { name: 'Check', exact: true })
        .getByRole('button', { name: 'Details ends the flow.', exact: true })
        .click();
    const detailsName = screen(page, 'details')
        .getByRole('button', { name: /^Details/ })
        .first();
    await expect(detailsName).toBeFocused();
    // The name says how to reach the links.
    await expect(detailsName).toHaveAccessibleDescription(
        "No links. Down arrow moves to the screen's menu and links."
    );
    // With no empty board to tap, a second tap on a selected screen lets go of it.
    const play = page.getByRole('link', { name: 'Play prototype', exact: true });
    await expect(detailsName).toHaveAttribute('aria-pressed', 'true');
    await expect(play).toHaveAttribute('href', '/prototype?screen=details');
    await detailsName.click();
    await expect(detailsName).toHaveAttribute('aria-pressed', 'false');
    await expect(play).toHaveAttribute('href', '/prototype');
    await expect(page.locator('iframe')).toHaveCount(0);
    // A wider window gets the map back; there is no switch.
    await page.setViewportSize({ width: 900, height: 844 });
    await expect(page.locator('[data-flow-board]')).toBeVisible();
    await expect(list).toHaveCount(0);
});

test('moves by keyboard: Tab between screens, arrows along a card, ⌫ removes, Esc deselects', async ({
    page
}) => {
    await seed(page, automaticLayoutsPrototype());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/flow');
    const home = page.getByRole('button', { name: 'Arrange Home', exact: true });
    const details = page.getByRole('button', { name: 'Arrange Details', exact: true });
    await expect(home).toHaveAccessibleDescription(
        "2 links. Down arrow moves to the screen's menu and links."
    );
    await home.focus();
    // One Tab stop per screen.
    await page.keyboard.press('Tab');
    await expect(details).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(home).toBeFocused();
    // ↓ walks the card: its menu button, then its rows.
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('button', { name: 'More for Home', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(row(page, 'next')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(linkMenu(page, 'Continue button')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(row(page, 'next')).toBeFocused();
    await expect(row(page, 'next')).toHaveAttribute('aria-pressed', 'true');
    // With the menu closed, Esc deselects.
    await page.keyboard.press('Escape');
    await expect(row(page, 'next')).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('ArrowDown');
    await expect(row(page, 'wide-next')).toBeFocused();
    // ⌫ removes the link in one undo step and says so.
    await page.keyboard.press('Backspace');
    await expect(row(page, 'wide-next')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add link on Home', exact: true })).toBeFocused();
    await expect(page.locator('[data-flow-announce]')).toHaveText(
        'Link removed: Wide continue goes to Details'
    );
    await page.keyboard.press('ControlOrMeta+z');
    await expect(row(page, 'wide-next')).toBeVisible();
    await expect(page.locator('[data-flow-announce]')).toHaveText(
        'Link added: Wide continue goes to Details'
    );
    // Tidy up has a keyboard path: the screen's own menu, once something was moved.
    await home.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Screen Home', exact: true });
    await expect(menu.getByRole('menuitem', { name: 'Tidy up', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await home.focus();
    const before = await settled(screen(page, 'home'));
    await page.keyboard.press('Alt+ArrowDown');
    expect((await settled(screen(page, 'home'))).y).toBe(before.y + 20);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await menu.getByRole('menuitem', { name: 'Tidy up', exact: true }).click();
    expect((await settled(screen(page, 'home'))).y).toBe(before.y);
});

test('leaves a locked link alone when ⌫ is pressed on its row', async ({ page }) => {
    const document = automaticLayoutsPrototype();
    document.shapes.next.locked = true;
    await seed(page, document);
    await page.goto('/flow');
    await row(page, 'next').focus();
    await page.keyboard.press('Backspace');
    await expect(row(page, 'next')).toHaveAccessibleDescription('Continue button goes to Details');
});

test('keeps Check readable and large enough to tap on a touch screen', async ({ browser }) => {
    const context = await browser.newContext({
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 }
    });
    const page = await context.newPage();
    const document = automaticLayoutsPrototype();
    (document.shapes.next as InstanceShape).interactions = {
        activate: { type: 'navigate', screenId: 'deleted-screen' }
    };
    await seed(page, document);
    await page.goto('/flow');
    const button = check(page);
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await button.tap();
    const panel = page.getByRole('dialog', { name: 'Check', exact: true });
    // Opaque, so the list underneath never shows through the remarks.
    await expect(panel).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    for (const target of await panel.locator('button, select').all()) {
        expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await context.close();
});
