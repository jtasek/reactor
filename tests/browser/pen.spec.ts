import { expect, test } from '@playwright/test';
import { openEditor, pointer, shapes } from './support/editor';

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
        }
        await page.keyboard.press('p');
        await pointer(page, 'pointerdown', { x: 900, y: 550 });
        await pointer(page, 'pointermove', { x: 950, y: 550 });
        await pointer(page, 'pointermove', { x: 1000, y: 600 });
        await pointer(page, 'pointerup', { x: 1050, y: 550 });
        const stroke = shapes(page).locator('polyline[data-cy]').last();
        await expect(stroke).toBeVisible();
        const before = await stroke.getAttribute('points');
        const at = await stroke.evaluate((element) => {
            const stroke = element as SVGPolylineElement;
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
        await expect(stroke).not.toHaveAttribute('points', before!);
        expect(errors).toEqual([]);
    });
}
