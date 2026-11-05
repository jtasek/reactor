import { expect, test } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { automaticLayoutsPrototype } from '../support/automaticScreenLayouts';
import { openEditor } from './support/editor';
import type { InstanceShape } from 'src/app/types';

test('connects and removes actions in Flow, reflects them in Inspector, and arranges only the diagram', async ({
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
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
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
    const next = page.locator('[data-flow-control="next"]');
    await expect(next).toHaveAccessibleName('Continue button');
    await expect(next).toHaveAccessibleDescription('Go to Details');
    await next.getByText('Go to Details', { exact: true }).click();
    await page.getByRole('button', { name: 'Connect to Home', exact: true }).click();
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toHaveValue('"home"');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toHaveValue('inherit');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toHaveValue('"home"');
    await page.getByLabel('Start screen for reachability').selectOption('details');
    await expect(page.getByText('Not reachable from the chosen screen.')).toBeVisible();
    const node = page.locator('[data-flow-screen="home"]');
    const before = await node.boundingBox();
    await page.getByRole('button', { name: 'Arrange Home' }).press('ArrowDown');
    expect((await node.boundingBox())!.y).toBe(before!.y + 20);
    const heading = page.getByRole('button', { name: 'Arrange Details' });
    const location = await heading.boundingBox();
    await page.mouse.move(location!.x + 40, location!.y + 20);
    await page.mouse.down();
    await page.mouse.move(location!.x - 20, location!.y + 50, { steps: 3 });
    await page.mouse.up();
    await expect(page.locator('[data-flow-screen="details"]')).toHaveCSS(
        'transform',
        'matrix(1, 0, 0, 1, -60, 30)'
    );
    await page.screenshot({ path: 'test-results/flow.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toBeVisible();
    await page.screenshot({ path: 'test-results/flow-narrow.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('link', { name: 'Back to canvas' }).click();
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toHaveValue('"home"');
    expect(await hit.boundingBox()).toEqual(geometry);
    await page.getByLabel(/^On (activation|Enter): action$/).selectOption('none');
    await page.getByRole('link', { name: 'Open flow' }).click();
    await page.locator('[data-flow-control="next"]').click();
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toHaveValue('none');
    await expect(node).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 20)');
    await page.getByLabel(/^On (activation|Enter): action$/).selectOption('inherit');
    await expect(
        page.getByLabel(/^On (activation|Enter): action$/).locator('option:checked')
    ).toHaveText('Source: Details');
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Flow', exact: true })).toBeVisible();
});

test('shows unavailable destinations and prevents edits to locked controls on direct visits', async ({
    page
}) => {
    const document = automaticLayoutsPrototype();
    document.components.button.interactions = {
        activate: { type: 'navigate', screenId: 'deleted-screen' }
    };
    document.shapes.next.locked = true;
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.goto('/flow');
    await expect(page.getByText('Unavailable target').first()).toBeVisible();
    await page.locator('[data-flow-control="next"]').click();
    await expect(page.getByRole('button', { name: 'Connect to Home', exact: true })).toBeDisabled();
    await expect(
        page.getByText('This control is locked or belongs to an imported component.', {
            exact: false
        })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Wide continue', exact: true }).click();
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toBeEnabled();
    await page.getByLabel(/^On (activation|Enter): action$/).selectOption('none');
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toHaveValue('none');
    await expect(page.locator('iframe')).toHaveCount(0);
});

test('undoes and redoes with keyboard shortcuts', async ({ page }) => {
    const document = automaticLayoutsPrototype();
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.goto('/flow');
    await page.locator('[data-flow-control="next"]').click();
    await page.getByRole('button', { name: 'Connect to Home', exact: true }).click();
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toHaveValue('"home"');
    await page.locator('[data-flow-control="next"]').focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toHaveValue('inherit');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toHaveValue('"home"');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toHaveValue('inherit');
});

test('marks hidden controls and leaves them out of reachability', async ({ page }) => {
    const document = automaticLayoutsPrototype();
    document.shapes.next.visible = false;
    document.shapes['wide-next'].visible = false;
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.goto('/flow');
    await expect(page.getByText('Hidden, not in Preview')).toHaveCount(2);
    await page.getByLabel('Start screen for reachability').selectOption('home');
    await expect(
        page
            .locator('[data-flow-screen="details"]')
            .getByText('Not reachable from the chosen screen.')
    ).toBeVisible();
});

test('treats a link that starts hidden in prototype as unreachable until something reveals it', async ({
    page
}) => {
    const document = automaticLayoutsPrototype();
    for (const id of ['next', 'wide-next']) {
        (document.shapes[id] as InstanceShape).prototypeVisible = false;
    }
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.goto('/flow');
    await expect(page.getByText('Starts hidden in prototype')).toHaveCount(2);
    await page.getByLabel('Start screen for reachability').selectOption('home');
    await expect(
        page
            .locator('[data-flow-screen="details"]')
            .getByText('Not reachable from the chosen screen.')
    ).toBeVisible();
});

test('scrolls the control editor into view on a short window', async ({ page }) => {
    const document = automaticLayoutsPrototype();
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/flow');
    await page.locator('[data-flow-control="next"]').click();
    await expect(page.getByLabel(/^On (activation|Enter): action$/)).toBeInViewport({ ratio: 1 });
    await expect(page.locator('[data-flow-control="next"]')).toBeFocused();
});

test('keeps arranged screen positions when opening and closing the side editor', async ({
    page
}) => {
    const document = automaticLayoutsPrototype();
    document.frames.third = { ...document.frames.details, id: 'third', name: 'Third' };
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/flow');
    const screen = page.locator('[data-flow-screen="third"]');
    await expect(screen).toBeVisible();
    const position = () =>
        screen.evaluate((element) => ({
            x: (element as HTMLElement).offsetLeft,
            y: (element as HTMLElement).offsetTop
        }));
    const before = await position();
    await page.locator('[data-flow-control="next"]').click();
    await expect(page.getByRole('complementary', { name: 'Selected control' })).toBeVisible();
    expect(await position()).toEqual(before);
    await page.getByRole('button', { name: 'Deselect control' }).click();
    expect(await position()).toEqual(before);
});

for (const [width, beside] of [
    [1100, true],
    [1099, false]
] as const) {
    test(`shows the whole default board ${beside ? 'beside' : 'above'} the editor at ${width}px`, async ({
        page
    }) => {
        const document = automaticLayoutsPrototype();
        const saved = serializePersistedState({
            currentDocumentId: document.id,
            documents: { [document.id]: document }
        });
        await page.addInitScript(
            (raw) => localStorage.setItem('reactor', raw),
            JSON.stringify(saved)
        );
        await page.setViewportSize({ width, height: 800 });
        await page.goto('/flow');
        await page.locator('[data-flow-control="next"]').click();
        const editor = page.getByRole('complementary', { name: 'Selected control' });
        await expect(editor).toBeVisible();
        const details = page.locator('[data-flow-screen="details"]');
        // The diagram is the board's scrolling ancestor; the card must fit inside it.
        const clipped = await details.evaluate((element) => {
            let diagram = element.parentElement;
            while (diagram && getComputedStyle(diagram).overflowX !== 'auto') {
                diagram = diagram.parentElement;
            }
            return element.getBoundingClientRect().right > diagram!.getBoundingClientRect().right;
        });
        expect(clipped).toBe(false);
        const card = (await details.boundingBox())!;
        const aside = (await editor.boundingBox())!;
        expect(aside.y > card.y + card.height).toBe(!beside);
    });
}

test('describes controls whose imported IDs contain spaces', async ({ page }) => {
    const document = automaticLayoutsPrototype();
    document.shapes['next control'] = { ...document.shapes.next, id: 'next control' };
    delete document.shapes.next;
    document.shapesIds = document.shapesIds.map((id) => (id === 'next' ? 'next control' : id));
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.goto('/flow');
    const control = page.locator('[data-flow-control="next control"]');
    await expect(control).toHaveAccessibleName('Continue button');
    await expect(control).toHaveAccessibleDescription('Go to Details');
    await control.press('Enter');
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('complementary', { name: 'Selected control' })).toBeVisible();
});
