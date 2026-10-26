import { expect, test } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor, pointer } from './support/editor';

function fixture(restriction?: 'locked' | 'stack' | 'nested-stack') {
    const shape = createShape({
        type: 'rectangle',
        name: 'Body',
        order: 'a0',
        position: { x: 120, y: restriction === 'nested-stack' ? 190 : 110 },
        size: { width: 80, height: 60 },
        parentFrameId: restriction === 'nested-stack' ? 'child' : 'home',
        locked: restriction === 'locked'
    });
    const document = createDocument({
        id: 'screen-view-handles',
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                name: 'Home',
                position: { x: 100, y: 80 },
                size: { width: 300, height: 200 },
                visible: true,
                locked: false,
                ...(restriction === 'stack'
                    ? {
                          stack: {
                              direction: 'column' as const,
                              gap: 0,
                              padding: 20,
                              align: 'start' as const
                          }
                      }
                    : {})
            },
            desktop: {
                id: 'desktop',
                kind: 'view',
                screenId: 'home',
                name: 'Desktop',
                position: { x: 500, y: 300 },
                size: { width: 500, height: 250 },
                visible: true,
                locked: false
            }
        },
        shapes: { [shape.id]: shape }
    });

    if (restriction === 'nested-stack') {
        document.frames.home.stack = { direction: 'row', gap: 0, padding: 0, align: 'end' };
        document.frames.child = {
            id: 'child',
            name: 'Content',
            kind: 'frame',
            parentFrameId: 'home',
            position: { x: 100, y: 180 },
            size: { width: 100, height: 100 },
            visible: true,
            locked: false
        };
    }

    return serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
}

test('resizes and rotates shared artwork through real Screen view handles', async ({ page }) => {
    await page.addInitScript(
        (data) => localStorage.setItem('reactor', JSON.stringify(data)),
        fixture()
    );
    await openEditor(page);
    await page.getByRole('button', { name: 'More panels' }).click();
    const desktop = page.locator('svg#surface #screen-views > [data-screen-view="desktop"]');
    const artwork = desktop.locator('rect[data-cy="Body"]');
    const bodyBox = (await artwork.boundingBox())!;
    await page.mouse.click(bodyBox.x + bodyBox.width / 2, bodyBox.y + bodyBox.height / 2);
    const bottomRight = desktop.locator('[data-handle][data-type="bottomRight"]');
    await expect(bottomRight).toBeVisible();
    await expect(bottomRight).toHaveAttribute('cx', '600');
    await expect(bottomRight).toHaveAttribute('cy', '390');
    const handle = (await bottomRight.boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2 + 30, {
        steps: 5
    });
    await page.mouse.up();
    await expect(artwork).toHaveAttribute('width', '120');
    await expect(artwork).toHaveAttribute('height', '90');
    await expect(
        page.locator(
            'svg#surface #screen-views > [data-screen-view="home:view"] rect[data-cy="Body"]'
        )
    ).toHaveAttribute('width', '120');

    const rotate = '#screen-views > [data-screen-view="desktop"] [data-handle][data-type="rotate"]';
    await pointer(page, 'pointerdown', { x: 580, y: 306, target: rotate });
    await pointer(page, 'pointermove', { x: 700, y: 375 });
    await expect(desktop.locator('g[data-shape-id]')).toHaveAttribute(
        'transform',
        'rotate(90 580 375)'
    );
    await pointer(page, 'pointercancel', { x: 700, y: 375 });
    await expect(desktop.locator('g[data-shape-id]')).not.toHaveAttribute('transform');
    await pointer(page, 'pointerdown', { x: 580, y: 306, target: rotate });
    await pointer(page, 'pointerup', { x: 700, y: 375 });
    await expect(desktop.locator('g[data-shape-id]')).toHaveAttribute(
        'transform',
        'rotate(90 580 375)'
    );

    await page.setViewportSize({ width: 600, height: 850 });
    const mobile = page.locator('svg#surface #screen-views > [data-screen-view="home:view"]');
    await expect(mobile.locator('[data-type="rotate"]')).toBeVisible();
});

for (const restriction of ['locked', 'stack', 'nested-stack'] as const) {
    test(`keeps ${restriction} artwork selectable without transform handles`, async ({ page }) => {
        await page.addInitScript(
            (data) => localStorage.setItem('reactor', JSON.stringify(data)),
            fixture(restriction)
        );
        await openEditor(page);
        await page.getByRole('button', { name: 'More panels' }).click();
        const desktop = page.locator('svg#surface #screen-views > [data-screen-view="desktop"]');
        const bodyBox = (await desktop.locator('rect[data-cy="Body"]').boundingBox())!;
        await page.mouse.click(bodyBox.x + bodyBox.width / 2, bodyBox.y + bodyBox.height / 2);
        await expect(desktop.locator('rect[stroke="var(--selection-color)"]')).toBeVisible();
        await expect(desktop.locator('[data-handle]')).toHaveCount(0);

        if (restriction === 'nested-stack') {
            await expect(
                page.locator(
                    'svg#surface #screen-views > [data-screen-view="home:view"] [data-type="bottomRight"]'
                )
            ).toBeVisible();
        }
    });
}
