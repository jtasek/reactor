import { expect, test } from '@playwright/test';

test('opens the editor and pans the SVG surface', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    const surface = page.locator('svg#surface');
    await expect(surface).toBeVisible();
    const camera = surface.locator('#camera');
    const before = await camera.getAttribute('transform');
    await surface.hover();
    await page.mouse.wheel(0, 100);
    await expect(camera).not.toHaveAttribute('transform', before ?? '');
    expect(errors).toEqual([]);
});
