import { expect, test } from '@playwright/test';

test('slider zoom preserves a panned camera position', async ({ page }) => {
    await page.goto('/');

    const surface = page.locator('svg#surface');
    const camera = surface.locator('#camera');

    await expect(surface).toBeVisible();
    await surface.hover();
    await page.mouse.wheel(40, 80);
    await expect(camera).toHaveAttribute('transform', 'translate(-40,-80) scale(1)');

    await page.locator('input[type="range"]').focus();
    await page.keyboard.press('ArrowRight');

    await expect(camera).toHaveAttribute('transform', 'translate(-40,-80) scale(1.1)');
});

test('rapid pinch events anchor correctly on an offset and scaled SVG', async ({ page }) => {
    await page.goto('/');

    const surface = page.locator('svg#surface');

    await expect(surface).toBeVisible();

    const anchor = await surface.evaluate((element) => {
        const svg = element as SVGSVGElement;

        svg.style.width = '600px';
        svg.style.height = '400px';
        svg.style.transform = 'translate(45px, 25px) scale(0.75)';
        svg.style.transformOrigin = '0 0';
        svg.setAttribute('viewBox', '0 0 300 200');

        const client = new DOMPoint(120, 80).matrixTransform(svg.getScreenCTM()!);

        for (let index = 0; index < 20; index++) {
            svg.dispatchEvent(
                new WheelEvent('wheel', {
                    clientX: client.x,
                    clientY: client.y,
                    ctrlKey: true,
                    deltaY: -0.5,
                    bubbles: true
                })
            );
        }

        return { x: client.x, y: client.y };
    });

    const camera = surface.locator('#camera');

    await expect
        .poll(async () =>
            camera.evaluate(
                (element) => (element as SVGGElement).transform.baseVal.consolidate()!.matrix.a
            )
        )
        .toBeCloseTo(Math.exp(0.1), 6);

    const world = await camera.evaluate((element, point) => {
        const matrix = (element as SVGGElement).getScreenCTM()!;
        const result = new DOMPoint(point.x, point.y).matrixTransform(matrix.inverse());

        return { x: result.x, y: result.y };
    }, anchor);

    expect(world.x).toBeCloseTo(120, 4);
    expect(world.y).toBeCloseTo(80, 4);
});
