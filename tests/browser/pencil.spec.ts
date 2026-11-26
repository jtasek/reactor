import { expect, test } from '@playwright/test';
import { drawRect, openEditor, pointer, shapes } from './support/editor';

for (const template of [false, true]) {
    test(`moves a selected pencil shape from inside its box${template ? ' beside template screens' : ''}`, async ({
        page
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await openEditor(page);
        if (template) {
            await page.goto('/documents');
            await page.getByRole('button', { name: 'Templates', exact: true }).click();
            await page.getByRole('button', { name: 'Use Forms template', exact: true }).click();
            await expect(page.locator('#screen-views > g').first()).toBeVisible();
            await page.getByRole('button', { name: 'Close guide' }).click();
        }
        await page.keyboard.press('p');
        await pointer(page, 'pointerdown', { x: 900, y: 550 });
        await pointer(page, 'pointermove', { x: 950, y: 550 });
        await pointer(page, 'pointermove', { x: 1000, y: 600 });
        await pointer(page, 'pointerup', { x: 1050, y: 550 });
        const stroke = shapes(page).locator('path[data-cy]').last();
        await expect(stroke).toBeVisible();
        const before = await stroke.getAttribute('d');
        const at = await stroke.evaluate((element) => {
            const stroke = element as SVGPathElement;
            const box = stroke.getBBox();
            // Inside the selected box, well away from either segment of the V.
            const point = new DOMPoint(
                box.x + box.width / 2,
                box.y + box.height / 4
            ).matrixTransform(stroke.getScreenCTM()!);
            return { x: point.x, y: point.y };
        });
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.move(at.x + 40, at.y + 30, { steps: 4 });
        await page.mouse.up();
        await expect(stroke).not.toHaveAttribute('d', before!);
        expect(errors).toEqual([]);
    });
}

test('a shape inside a selected line’s box can still be selected and dragged', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 300, y: 140 }, { x: 340, y: 180 });
    await page.keyboard.press('l');
    await pointer(page, 'pointerdown', { x: 100, y: 100 });
    await pointer(page, 'pointermove', { x: 250, y: 250 });
    await pointer(page, 'pointerup', { x: 400, y: 400 });
    await expect(shapes(page)).toHaveCount(2);
    const surface = (await page.locator('svg#surface').boundingBox())!;
    const at = (x: number, y: number) => ({ x: surface.x + x, y: surface.y + y });
    const rotateHandle = (index: number) =>
        shapes(page).nth(index).locator('[data-handle][data-type="rotate"]');

    // The line is selected after drawing; its box covers the rectangle.
    await page.mouse.click(at(250, 250).x, at(250, 250).y);
    await expect(rotateHandle(1)).toBeVisible();
    await page.mouse.click(at(320, 160).x, at(320, 160).y);
    await expect(rotateHandle(0)).toBeVisible();
    await expect(rotateHandle(1)).toHaveCount(0);

    await page.mouse.click(at(250, 250).x, at(250, 250).y);
    const rect = shapes(page).first().locator('rect[data-cy]');
    const before = (await rect.boundingBox())!;
    await page.mouse.move(at(320, 160).x, at(320, 160).y);
    await page.mouse.down();
    await page.mouse.move(at(360, 160).x, at(360, 160).y, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => (await rect.boundingBox())!.x - before.x).toBeCloseTo(40, 0);
});

test('the Pencil smooths a stroke by the level chosen in the Inspector', async ({ page }) => {
    await openEditor(page, ['Inspector']);
    await page.keyboard.press('p');
    const smoothing = page.getByRole('group', { name: 'Smoothing' });
    await expect(smoothing.getByRole('button', { name: 'Low' })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    const draw = async (y: number) => {
        await pointer(page, 'pointerdown', { x: 300, y });
        for (let step = 1; step <= 20; step++) {
            await pointer(page, 'pointermove', {
                x: 300 + step * 10,
                y: y + (step % 2) + step * 3
            });
        }
        await pointer(page, 'pointerup', { x: 500, y: y + 60 });
        return shapes(page).locator('path[data-cy]').last().getAttribute('d');
    };

    await smoothing.getByRole('button', { name: 'Off' }).click();
    const off = await draw(100);
    expect(off).not.toContain('C');
    expect(off!.match(/L/g)!.length).toBeGreaterThan(15);

    await page.keyboard.press('p');
    await smoothing.getByRole('button', { name: 'High' }).click();
    const high = await draw(300);
    expect(high!.match(/[LC]/g)!.length).toBeLessThan(5);

    await page.reload();
    await expect(page.getByText('No shapes selected')).toBeVisible();
    await page.keyboard.press('p');
    await expect(smoothing.getByRole('button', { name: 'High' })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
});
