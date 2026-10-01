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

test('canvas wheel gestures cancel the browser default action', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('html')).toHaveCSS('overscroll-behavior', 'none');

    const result = await page.locator('svg#surface').evaluate((surface) => {
        const event = new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            deltaX: 100
        });

        return {
            dispatchResult: surface.dispatchEvent(event),
            defaultPrevented: event.defaultPrevented
        };
    });

    expect(result).toEqual({ dispatchResult: false, defaultPrevented: true });
});

test('pan bursts read the surface matrix once per frame and preserve every delta', async ({
    page
}) => {
    await page.goto('/');

    const surface = page.locator('svg#surface');

    await expect(surface).toBeVisible();

    const reads = await surface.evaluate(async (element) => {
        const svg = element as SVGSVGElement;

        svg.style.width = '600px';
        svg.style.height = '400px';
        svg.style.transform = 'translate(45px, 25px) scale(0.75)';
        svg.style.transformOrigin = '0 0';
        svg.setAttribute('viewBox', '0 0 300 200');

        const getScreenCTM = svg.getScreenCTM;
        let count = 0;

        svg.getScreenCTM = () => {
            count++;

            return getScreenCTM.call(svg);
        };

        try {
            for (let index = 0; index < 50; index++) {
                svg.dispatchEvent(
                    new WheelEvent('wheel', {
                        deltaX: 6,
                        deltaY: 3,
                        bubbles: true,
                        cancelable: true
                    })
                );
            }

            const beforeFrame = count;

            await new Promise(requestAnimationFrame);

            return { beforeFrame, afterFrame: count };
        } finally {
            svg.getScreenCTM = getScreenCTM;
        }
    });

    expect(reads).toEqual({ beforeFrame: 0, afterFrame: 1 });
    await expect(surface.locator('#camera')).toHaveAttribute(
        'transform',
        'translate(-200,-100) scale(1)'
    );
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
