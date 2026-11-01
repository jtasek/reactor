import { expect, test, type Page } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

async function openShapes(page: Page, screen = false) {
    const rectangle = createShape({
        type: 'rectangle',
        name: 'box',
        order: 'a0',
        position: { x: 350, y: 250 },
        size: { width: 100, height: 100 },
        rotation: 45,
        selected: true
    });
    const circle = createShape({
        type: 'circle',
        name: 'circle',
        order: 'a1',
        position: { x: 400, y: 500 },
        radius: 50,
        locked: true
    });
    const hidden = createShape({
        type: 'rectangle',
        name: 'hidden',
        order: 'a2',
        position: { x: 350, y: 600 },
        size: { width: 100, height: 50 },
        visible: false
    });
    const body = createShape({
        type: 'rectangle',
        name: 'body',
        order: 'a3',
        position: { x: 120, y: 110 },
        size: { width: 80, height: 60 },
        parentFrameId: 'home'
    });
    const document = createDocument({
        id: 'guide-crossings',
        shapes: screen
            ? { [body.id]: body }
            : { [rectangle.id]: rectangle, [circle.id]: circle, [hidden.id]: hidden },
        frames: screen
            ? {
                  home: {
                      id: 'home',
                      kind: 'screen',
                      definitionOnly: true,
                      name: 'Home',
                      position: { x: 100, y: 80 },
                      size: { width: 300, height: 200 },
                      visible: true,
                      locked: false
                  },
                  view: {
                      id: 'view',
                      kind: 'view',
                      name: 'Desktop',
                      screenId: 'home',
                      position: { x: 800, y: 100 },
                      size: { width: 300, height: 200 },
                      visible: true,
                      locked: false
                  }
              }
            : {}
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openEditor(page, ['Rulers', 'Guides']);
    await page.getByRole('checkbox', { name: 'Tool Bar', exact: true }).uncheck();
    await page.getByRole('button', { name: 'More panels' }).click();
    await expect(page.locator('svg#surface [data-ruler]')).toHaveCount(2);
}

const markers = (page: Page) => page.locator('svg#surface [data-guide-intersection]');

test('marks exact rotated and curved outlines during new and existing guide drags', async ({
    page
}) => {
    await openShapes(page);
    await page.mouse.move(10, 700);
    await page.mouse.down();
    await page.mouse.move(400, 700, { steps: 6 });
    await expect(markers(page)).toHaveCount(4);
    const ys = await markers(page).evaluateAll((nodes) =>
        nodes.map((node) => Number(node.getAttribute('cy'))).sort((a, b) => a - b)
    );
    expect(ys[0]).toBeCloseTo(300 - Math.sqrt(5000));
    expect(ys[1]).toBeCloseTo(300 + Math.sqrt(5000));
    expect(ys.slice(2)).toEqual([450, 550]);
    await expect(markers(page).first()).toHaveAttribute('r', '3');
    await page.screenshot({ path: 'test-results/guide-crossings.png' });
    await page.mouse.up();
    await expect(markers(page)).toHaveCount(0);
    await page.mouse.move(400, 700);
    await page.mouse.down();
    await page.mouse.move(420, 700, { steps: 6 });
    await expect(markers(page)).toHaveCount(4);
    await page.evaluate(() => {
        const surface = document.querySelector<SVGSVGElement>('svg#surface')!;
        surface.dataset.outlineReads = '0';
        const getBBox = SVGGraphicsElement.prototype.getBBox;
        SVGGraphicsElement.prototype.getBBox = function (...args) {
            if (this.closest('[data-guide-outline]')) {
                surface.dataset.outlineReads = String(Number(surface.dataset.outlineReads) + 1);
            }

            return getBBox.apply(this, args);
        };
    });
    await page.mouse.move(425, 700, { steps: 5 });
    await expect(page.locator('svg#surface')).toHaveAttribute('data-outline-reads', '0');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(markers(page)).toHaveCount(0);
    await expect(page.locator('svg#surface #guides > line')).toHaveAttribute('x1', '400');
    await page.mouse.move(400, 700);
    await page.mouse.down();
    await page.mouse.move(5, 700, { steps: 6 });
    await expect(markers(page)).toHaveCount(0);
    await page.mouse.up();
});

test('uses placed Screen view geometry and excludes its hidden source artwork', async ({
    page
}) => {
    await openShapes(page, true);
    await expect(page.locator('#screen-views [data-guide-outline]')).toBeVisible();
    await page.mouse.move(10, 700);
    await page.mouse.down();
    await page.mouse.move(850, 700, { steps: 6 });
    // The view's own top and bottom edges, then the projected shape.
    await expect(markers(page)).toHaveCount(4);
    const ys = await markers(page).evaluateAll((nodes) =>
        nodes.map((node) => Number(node.getAttribute('cy'))).sort((a, b) => a - b)
    );
    expect(ys).toEqual([100, 130, 190, 300]);
    await page.mouse.move(150, 700, { steps: 6 });
    await expect(markers(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.mouse.up();
});

test('keeps crossings in surface coordinates when the canvas is CSS-scaled', async ({ page }) => {
    await openShapes(page);
    await page.addStyleTag({
        content: 'svg#surface { transform: scale(0.5); transform-origin: 0 0; }'
    });
    await page.mouse.move(5, 350);
    await page.mouse.down();
    await page.mouse.move(200, 350, { steps: 6 });
    await expect(markers(page)).toHaveCount(4);
    await page.keyboard.press('Escape');
    await page.mouse.up();
});
