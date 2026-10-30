import { expect, test, type Page } from '@playwright/test';

test.use({ deviceScaleFactor: 2 });

/**
 * The middles, in device pixels from the left, of the lines crossing one row of
 * a PNG: runs of pixels darker than the row's usual shade, weighted by how dark.
 */
async function lineCentres(page: Page, png: Buffer, row: number) {
    return page.evaluate(
        async ({ data, row }) => {
            const image = new Image();

            image.src = `data:image/png;base64,${data}`;
            await image.decode();

            const canvas = document.createElement('canvas');

            canvas.width = image.width;
            canvas.height = image.height;

            const context = canvas.getContext('2d')!;

            context.drawImage(image, 0, 0);

            const pixels = context.getImageData(0, row, image.width, 1).data;
            const shades = Array.from({ length: image.width }, (_, x) =>
                Math.min(pixels[x * 4], pixels[x * 4 + 1], pixels[x * 4 + 2])
            );
            const usual = [...shades].sort((a, b) => a - b)[Math.floor(shades.length / 2)];
            const centres: number[] = [];
            let weight = 0;
            let moment = 0;

            for (let x = 0; x <= image.width; x++) {
                const darkness = x < image.width ? usual - shades[x] : 0;

                if (darkness > 3) {
                    weight += darkness;
                    moment += darkness * (x + 0.5);
                } else if (weight > 0) {
                    centres.push(moment / weight);
                    weight = 0;
                    moment = 0;
                }
            }

            return centres;
        },
        { data: png.toString('base64'), row }
    );
}

test('ruler marks line up with the grid lines at a fractional zoom and pan', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');

    const surface = page.locator('svg#surface');

    await expect(surface).toBeVisible();
    await page.getByRole('button', { name: 'More panels' }).click();
    await page.getByRole('checkbox', { name: 'Explorer', exact: true }).uncheck();
    await page.getByRole('checkbox', { name: 'Rulers', exact: true }).check();
    await page.getByRole('button', { name: 'More panels' }).click();
    await expect(surface.locator('[data-ruler="top"]')).toBeVisible();

    // A zoom and pan that put canvas positions between pixels.
    await surface.evaluate((element) => {
        const svg = element as SVGSVGElement;
        const box = svg.getBoundingClientRect();

        for (let index = 0; index < 3; index++) {
            svg.dispatchEvent(
                new WheelEvent('wheel', {
                    clientX: box.left + 333.3,
                    clientY: box.top + 271.7,
                    ctrlKey: true,
                    deltaY: -9.3,
                    bubbles: true,
                    cancelable: true
                })
            );
        }
    });
    await expect
        .poll(async () =>
            surface
                .locator('#camera')
                .evaluate(
                    (element) => (element as SVGGElement).transform.baseVal.consolidate()!.matrix.a
                )
        )
        .toBeGreaterThan(1.2);

    const box = (await surface.boundingBox())!;
    const shot = await page.screenshot({
        clip: { x: box.x + 100, y: box.y, width: 500, height: 400 }
    });
    // Low in the top ruler, which every mark reaches, and low in the canvas, under
    // the panels, where the grid's lines cross.
    const marks = await lineCentres(page, shot, 2 * 17);
    const lines = await lineCentres(page, shot, 2 * 350);

    expect(marks.length).toBeGreaterThan(10);

    for (const mark of marks) {
        const nearest = Math.min(...lines.map((line) => Math.abs(line - mark)));

        // Half a device pixel: what snapping a crisp mark to the pixel grid may cost.
        expect(nearest, `mark at ${mark}; grid lines at ${lines.join(', ')}`).toBeLessThanOrEqual(
            0.6
        );
    }
});
