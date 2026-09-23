import { expect, type Page } from '@playwright/test';

type PointerInit = {
    pointerId?: number;
    x: number;
    y: number;
    buttons?: number;
    target?: string;
    pointerType?: 'mouse' | 'pen';
};

/**
 * Dispatches a synthetic pointer event at surface-relative coordinates, on the
 * surface or on a `target` element inside it.
 */
export async function pointer(
    page: Page,
    type: string,
    { pointerId = 1, x, y, buttons, target, pointerType = 'mouse' }: PointerInit
) {
    const surface = page.locator('svg#surface');
    const box = await surface.boundingBox();

    await (target ? surface.locator(target) : surface).dispatchEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType,
        isPrimary: pointerId === 1,
        button: 0,
        buttons: buttons ?? (type === 'pointerup' || type === 'pointercancel' ? 0 : 1),
        clientX: box!.x + x,
        clientY: box!.y + y
    });
}

/** Opens the editor with the drawing tools, plus any other `controls`, shown. */
export async function openEditor(page: Page, controls: string[] = []) {
    await page.goto('/');
    await expect(page.locator('svg#surface')).toBeVisible();

    // The drawing tools live in the side bar, which is hidden by default.
    for (const control of ['Side Bar', 'Tool Bar', ...controls]) {
        await page.getByRole('checkbox', { name: control, exact: true }).check();
    }
}

export async function selectTool(page: Page, description: string) {
    await page.locator(`a[title="${description}"]`).dispatchEvent('click');
}

export const shapes = (page: Page) => page.locator('svg#surface #shapes > g');
export const handles = (page: Page) => page.locator('svg#surface [data-handle]');

export async function drawRect(
    page: Page,
    from: { x: number; y: number },
    to: { x: number; y: number }
) {
    await selectTool(page, 'Draws a rectangle or square');
    await pointer(page, 'pointerdown', from);
    await pointer(page, 'pointermove', to);
    await pointer(page, 'pointerup', to);
}

export const firstShape = (page: Page) => shapes(page).first();
