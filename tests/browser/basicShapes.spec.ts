import { expect, test, type Locator, type Page } from '@playwright/test';
import { openEditor, pointer, shapes } from './support/editor';

const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);
const kinds = [
    ['rectangle', 'r', 'rect'],
    ['circle', 'c', 'circle'],
    ['ellipse', 'e', 'ellipse'],
    ['line', 'l', 'line'],
    ['pen', 'p', 'polyline'],
    ['text', 't', 'text'],
    ['image', 'i', 'image']
] as const;

async function center(locator: Locator) {
    const box = (await locator.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
}

for (const template of [false, true]) {
    for (const [kind, shortcut, tag] of kinds) {
        test(`${kind}: select, move, resize and rotate${template ? ' beside screens' : ''}`, async ({
            page
        }) => {
            await page.setViewportSize({ width: 1600, height: 1100 });
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await openEditor(page);
            await page.getByRole('button', { name: 'More panels', exact: true }).click();
            if (template) {
                await page.goto('/documents');
                await page.getByRole('button', { name: 'Templates', exact: true }).click();
                await page.getByRole('button', { name: 'Use Forms template', exact: true }).click();
                await expect(page.locator('#screen-views > g').first()).toBeVisible();
            }
            if (kind === 'image') {
                const chooser = page.waitForEvent('filechooser');
                await page.keyboard.press(shortcut);
                await (
                    await chooser
                ).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
                await page.waitForTimeout(300);
            } else {
                await page.keyboard.press(shortcut);
            }
            await pointer(page, 'pointerdown', { x: 900, y: 750 });
            if (kind !== 'text') {
                await pointer(page, 'pointermove', { x: 940, y: 750 });
                await pointer(page, 'pointermove', { x: 960, y: 830 });
                const preview = page.locator(`#tools ${tag}[data-cy]`);
                const label = page.locator('#tools [data-size-label]');
                await expect(label).toBeVisible();
                const size = await preview.evaluate((element) => {
                    const box = (element as SVGGraphicsElement).getBBox();
                    return `${Math.round(box.width)} x ${Math.round(box.height)}`;
                });
                await expect(label).toHaveText(size);
            }
            await pointer(page, 'pointerup', {
                x: kind === 'text' ? 900 : 1020,
                y: kind === 'text' || kind === 'pen' ? 750 : 830
            });
            await expect(page.locator('#tools [data-size-label]')).toHaveCount(0);
            if (kind === 'text') {
                await page.keyboard.type('Basic shape');
                await page.keyboard.press('Enter');
            }
            const artwork = shapes(page).locator(`${tag}[data-cy]`).last();
            await expect(artwork).toBeVisible();
            const group = shapes(page).last();
            const handle = (type: string) => group.locator(`[data-handle][data-type="${type}"]`);

            await pointer(page, 'pointerdown', { x: 1500, y: 1000 });
            await pointer(page, 'pointerup', { x: 1500, y: 1000 });
            await expect(handle('rotate')).toHaveCount(0);
            const hit =
                kind === 'pen'
                    ? await artwork.evaluate((element) => {
                          const pen = element as SVGPolylineElement;
                          const a = pen.points.getItem(0),
                              b = pen.points.getItem(1);
                          const point = new DOMPoint(
                              (a.x + b.x) / 2,
                              (a.y + b.y) / 2
                          ).matrixTransform(pen.getScreenCTM()!);
                          return { x: point.x, y: point.y };
                      })
                    : await center(artwork);
            await page.mouse.click(hit.x, hit.y);
            await expect(handle('rotate')).toBeVisible();

            const beforeMove = (await artwork.boundingBox())!;
            const moveFrom = ['line', 'pen'].includes(kind)
                ? {
                      x: beforeMove.x + beforeMove.width / 2,
                      y: beforeMove.y + beforeMove.height / 4
                  }
                : hit;
            await drag(page, moveFrom, { x: moveFrom.x + 30, y: moveFrom.y + 25 });
            const moved = (await artwork.boundingBox())!;
            expect(moved.x - beforeMove.x).toBeCloseTo(30, 0);
            expect(moved.y - beforeMove.y).toBeCloseTo(25, 0);

            const corner = await center(handle('bottomRight'));
            const fixed = await center(handle('topLeft'));
            await drag(page, corner, { x: corner.x + 40, y: corner.y + 30 });
            const resized = (await artwork.boundingBox())!;
            expect(resized.width).toBeGreaterThan(moved.width + 10);
            if (moved.height > 1) {
                expect(resized.height).toBeGreaterThan(moved.height + 10);
            }
            const stillFixed = await center(handle('topLeft'));
            expect(stillFixed.x).toBeCloseTo(fixed.x, 0);
            expect(stillFixed.y).toBeCloseTo(fixed.y, 0);
            if (['circle', 'image', 'text'].includes(kind)) {
                expect(resized.width / resized.height).toBeCloseTo(moved.width / moved.height, 1);
            }

            const pivot = await center(artwork);
            const rotate = await center(handle('rotate'));
            await page.mouse.move(rotate.x, rotate.y);
            const target = await page.evaluate(
                ({ x, y }) => document.elementFromPoint(x, y)?.outerHTML,
                rotate
            );
            expect(target).toContain('data-type="rotate"');
            await drag(page, rotate, { x: pivot.x + 150, y: pivot.y });
            await expect
                .poll(async () => {
                    const transform = await group.getAttribute('transform');
                    return Number(/rotate\(([-\d.]+)/.exec(transform ?? '')?.[1]);
                })
                .toBeCloseTo(90, 0);
            const rotatedFixed = await center(handle('topLeft'));
            const rotatedCorner = await center(handle('bottomRight'));
            await drag(page, rotatedCorner, { x: rotatedCorner.x - 30, y: rotatedCorner.y + 40 });
            const afterRotationResize = await center(handle('topLeft'));
            expect(afterRotationResize.x).toBeCloseTo(rotatedFixed.x, 0);
            expect(afterRotationResize.y).toBeCloseTo(rotatedFixed.y, 0);
            expect(errors).toEqual([]);
        });
    }
}

test('drawing dimensions use canvas units when zoomed, follow reverse drags and clear on cancel', async ({
    page
}) => {
    await openEditor(page);
    const zoom = page.locator('input[type="range"]');
    await zoom.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#camera')).toHaveAttribute('transform', 'translate(0,0) scale(1.1)');
    await zoom.blur();
    await page.keyboard.press('r');
    await pointer(page, 'pointerdown', { x: 550, y: 440 });
    await pointer(page, 'pointermove', { x: 330, y: 330 });
    const label = page.locator('#tools [data-size-label]');
    await expect(label).toHaveText('200 x 100');
    await pointer(page, 'pointermove', { x: 110, y: 220 });
    await expect(label).toHaveText('400 x 200');
    await pointer(page, 'pointercancel', { x: 110, y: 220 });
    await expect(label).toHaveCount(0);
    await expect(shapes(page)).toHaveCount(0);
});
