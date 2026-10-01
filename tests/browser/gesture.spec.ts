import { expect, test, type Page } from '@playwright/test';
import {
    drawRect,
    firstShape,
    handles,
    openEditor,
    pointer,
    selectTool,
    shapes
} from './support/editor';

for (const pointerType of ['mouse', 'pen'] as const) {
    test(`a ${pointerType} drawing commits once, at the release position`, async ({ page }) => {
        await openEditor(page);
        await selectTool(page, 'Draws a rectangle or square');

        await pointer(page, 'pointerdown', { x: 100, y: 100, pointerType });
        await pointer(page, 'pointermove', { x: 150, y: 150, pointerType });
        await pointer(page, 'pointerup', { x: 200, y: 180, pointerType });

        await expect(shapes(page)).toHaveCount(1);
        const rect = shapes(page).locator('rect[data-cy]').first();
        await expect(rect).toHaveAttribute('width', '100');
        await expect(rect).toHaveAttribute('height', '80');
    });
}

for (const interruption of ['pointercancel', 'lostpointercapture'] as const) {
    test(`${interruption} discards the drawing in progress`, async ({ page }) => {
        await openEditor(page);
        await selectTool(page, 'Draws a rectangle or square');

        await pointer(page, 'pointerdown', { x: 100, y: 100 });
        await pointer(page, 'pointermove', { x: 150, y: 150 });
        await pointer(page, interruption, { x: 150, y: 150 });
        await pointer(page, 'pointerup', { x: 150, y: 150 });

        await expect(shapes(page)).toHaveCount(0);
    });
}

test('window blur discards the drawing in progress', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');

    await pointer(page, 'pointerdown', { x: 100, y: 100 });
    await pointer(page, 'pointermove', { x: 150, y: 150 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await pointer(page, 'pointerup', { x: 150, y: 150 });

    await expect(shapes(page)).toHaveCount(0);
});

test('opening the context menu discards the drawing in progress', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');

    await pointer(page, 'pointerdown', { x: 100, y: 100 });
    await pointer(page, 'pointermove', { x: 150, y: 150 });
    await page.locator('svg#surface').dispatchEvent('contextmenu', { bubbles: true });
    await pointer(page, 'pointerup', { x: 150, y: 150 });

    await expect(shapes(page)).toHaveCount(0);
});

test('a second pointer cannot take over or commit an active gesture', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');

    await pointer(page, 'pointerdown', { pointerId: 1, x: 100, y: 100 });
    await pointer(page, 'pointermove', { pointerId: 1, x: 150, y: 150 });
    await pointer(page, 'pointerdown', { pointerId: 2, x: 300, y: 300 });
    await pointer(page, 'pointermove', { pointerId: 2, x: 320, y: 320 });
    await pointer(page, 'pointerup', { pointerId: 2, x: 320, y: 320 });
    await pointer(page, 'pointerup', { pointerId: 1, x: 200, y: 200 });

    await expect(shapes(page)).toHaveCount(1);
    const rect = shapes(page).locator('rect[data-cy]').first();
    await expect(rect).toHaveAttribute('x', '100');
    await expect(rect).toHaveAttribute('y', '100');
    await expect(rect).toHaveAttribute('width', '100');
});

test('ctrl-wheel does not zoom during a drag', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');

    const camera = page.locator('svg#surface #camera');
    const before = await camera.getAttribute('transform');

    await pointer(page, 'pointerdown', { x: 100, y: 100 });
    await pointer(page, 'pointermove', { x: 150, y: 150 });
    await page
        .locator('svg#surface')
        .dispatchEvent('wheel', { bubbles: true, ctrlKey: true, deltaY: -50 });

    await expect(camera).toHaveAttribute('transform', before ?? '');
    await pointer(page, 'pointerup', { x: 150, y: 150 });
});

test('a canceled marquee restores the previous selection', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await expect(handles(page).first()).toBeVisible();

    await pointer(page, 'pointerdown', { x: 400, y: 400 });
    await pointer(page, 'pointermove', { x: 450, y: 450 });
    await expect(handles(page)).toHaveCount(0);

    await pointer(page, 'pointercancel', { x: 450, y: 450 });

    await expect(handles(page).first()).toBeVisible();
});

test('moving a shape follows the pointer to its release position', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    await pointer(page, 'pointerdown', { x: 120, y: 120 });
    await pointer(page, 'pointermove', { x: 140, y: 140 });
    await pointer(page, 'pointerup', { x: 170, y: 160 });

    const rect = firstShape(page).locator('rect[data-cy]');
    await expect(rect).toHaveAttribute('x', '150');
    await expect(rect).toHaveAttribute('y', '140');
});

test('a fast move and release in one task is not lost', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });
    await pointer(page, 'pointerdown', { x: 120, y: 120 });

    await page.locator('svg#surface').evaluate((svg) => {
        const { left, top } = svg.getBoundingClientRect();
        const init = { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true };

        svg.dispatchEvent(
            new PointerEvent('pointermove', {
                ...init,
                buttons: 1,
                clientX: left + 180,
                clientY: top + 170
            })
        );
        svg.dispatchEvent(
            new PointerEvent('pointerup', { ...init, clientX: left + 180, clientY: top + 170 })
        );
    });

    const rect = firstShape(page).locator('rect[data-cy]');
    await expect(rect).toHaveAttribute('x', '160');
    await expect(rect).toHaveAttribute('y', '150');
});

test('a canceled move restores the shape position', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    await pointer(page, 'pointerdown', { x: 120, y: 120 });
    await pointer(page, 'pointermove', { x: 160, y: 170 });
    await expect(firstShape(page).locator('rect[data-cy]')).toHaveAttribute('x', '140');
    await pointer(page, 'pointercancel', { x: 160, y: 170 });

    const rect = firstShape(page).locator('rect[data-cy]');
    await expect(rect).toHaveAttribute('x', '100');
    await expect(rect).toHaveAttribute('y', '100');
});

test('resizing applies the release position and a canceled resize restores the size', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const handle = '[data-handle][data-type="bottomRight"]';
    const rect = firstShape(page).locator('rect[data-cy]');

    await pointer(page, 'pointerdown', { x: 150, y: 150, target: handle });
    await pointer(page, 'pointermove', { x: 180, y: 170 });
    await pointer(page, 'pointerup', { x: 200, y: 190 });

    await expect(rect).toHaveAttribute('width', '100');
    await expect(rect).toHaveAttribute('height', '90');

    await pointer(page, 'pointerdown', { x: 200, y: 190, target: handle });
    await pointer(page, 'pointermove', { x: 260, y: 260 });
    await expect(rect).toHaveAttribute('width', '160');
    await pointer(page, 'pointercancel', { x: 260, y: 260 });

    await expect(rect).toHaveAttribute('width', '100');
    await expect(rect).toHaveAttribute('height', '90');
});

test('rotating applies the release position and a canceled rotation restores it', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const handle = '[data-handle][data-type="rotate"]';
    const group = firstShape(page);

    await pointer(page, 'pointerdown', { x: 125, y: 76, target: handle });
    await pointer(page, 'pointermove', { x: 125, y: 225 });
    await pointer(page, 'pointerup', { x: 225, y: 125 });

    await expect(group).toHaveAttribute('transform', 'rotate(90 125 125)');

    await pointer(page, 'pointerdown', { x: 225, y: 125, target: handle });
    await pointer(page, 'pointermove', { x: 125, y: 225 });
    await expect(group).toHaveAttribute('transform', 'rotate(180 125 125)');
    await expect(group.getByText('180°')).toBeVisible();
    await pointer(page, 'pointercancel', { x: 125, y: 225 });

    await expect(group.getByText(/°$/)).toHaveCount(0);

    await expect(group).toHaveAttribute('transform', 'rotate(90 125 125)');
});

/** Where a handle is drawn, in surface coordinates. */
async function handleCenter(page: Page, type: string) {
    const surface = (await page.locator('svg#surface').boundingBox())!;
    const box = (await page.locator(`[data-handle][data-type="${type}"]`).boundingBox())!;

    return {
        x: box.x + box.width / 2 - surface.x,
        y: box.y + box.height / 2 - surface.y,
        size: box.width
    };
}

test('a rotated shape resizes from the handle under the pointer, with the opposite corner in place', async ({
    page
}) => {
    await openEditor(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    // Rotated by 90°, the bottom-right handle is drawn at (100, 150) and the
    // top-left one at (150, 100).
    await pointer(page, 'pointerdown', {
        x: 125,
        y: 76,
        target: '[data-handle][data-type="rotate"]'
    });
    await pointer(page, 'pointerup', { x: 225, y: 125 });
    await expect(firstShape(page)).toHaveAttribute('transform', 'rotate(90 125 125)');

    const handle = '[data-handle][data-type="bottomRight"]';

    await pointer(page, 'pointerdown', { x: 100, y: 150, target: handle });
    await pointer(page, 'pointermove', { x: 90, y: 165 });
    await pointer(page, 'pointerup', { x: 80, y: 180 });

    const anchor = await handleCenter(page, 'topLeft');
    const dragged = await handleCenter(page, 'bottomRight');

    expect(anchor.x).toBeCloseTo(150, 0);
    expect(anchor.y).toBeCloseTo(100, 0);
    expect(dragged.x).toBeCloseTo(80, 0);
    expect(dragged.y).toBeCloseTo(180, 0);
});

test('handles keep their size on screen at any zoom', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 200, y: 200 }, { x: 320, y: 280 });

    for (const key of ['+', '+', '+', '-', '-', '-', '-', '-', '-']) {
        await page.keyboard.press(key);

        const handle = await handleCenter(page, 'middleTop');
        const rotate = await handleCenter(page, 'rotate');

        // A radius of 5 pixels, and a border of 1.
        expect(handle.size).toBeCloseTo(11, 0);
        expect(rotate.size).toBeCloseTo(11, 0);
        expect(handle.y - rotate.y).toBeCloseTo(24, 0);
    }
});

test('a shape small on screen is moved, not resized, by pressing it', async ({ page }) => {
    await openEditor(page);
    await drawRect(page, { x: 200, y: 200 }, { x: 230, y: 220 });

    for (let step = 0; step < 6; step++) {
        await page.keyboard.press('-');
    }

    const rect = firstShape(page).locator('rect[data-cy]');
    const box = (await rect.boundingBox())!;
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 20, center.y, { steps: 4 });
    await page.mouse.up();

    await expect(rect).toHaveAttribute('width', '30');
    await expect(rect).toHaveAttribute('height', '20');
    await expect(rect).not.toHaveAttribute('x', '200');
});

type Contact = { id: number; x: number; y: number };

/**
 * Replays touch input the way Chromium delivers it: Pointer Events for each
 * contact first, then the Touch Event carrying the full touch list.
 */
async function touch(
    page: Page,
    type: 'start' | 'move' | 'end',
    changed: Contact[],
    active: Contact[]
) {
    await page.locator('svg#surface').evaluate(
        (svg, { type, changed, active }) => {
            const { left, top } = svg.getBoundingClientRect();
            const toTouch = ({ id, x, y }: Contact) =>
                new Touch({ identifier: id, target: svg, clientX: left + x, clientY: top + y });
            const pointerType = { start: 'pointerdown', move: 'pointermove', end: 'pointerup' };

            for (const contact of changed) {
                svg.dispatchEvent(
                    new PointerEvent(pointerType[type], {
                        bubbles: true,
                        pointerId: contact.id,
                        pointerType: 'touch',
                        isPrimary: contact.id === active.concat(changed)[0]?.id,
                        buttons: type === 'end' ? 0 : 1,
                        clientX: left + contact.x,
                        clientY: top + contact.y
                    })
                );
            }

            svg.dispatchEvent(
                new TouchEvent(`touch${type}`, {
                    bubbles: true,
                    cancelable: true,
                    touches: active.map(toTouch),
                    targetTouches: active.map(toTouch),
                    changedTouches: changed.map(toTouch)
                })
            );
        },
        { type, changed, active }
    );
}

const camera = (page: Page) => page.locator('svg#surface #camera');

test('a touch pinch zooms around the midpoint of the contacts', async ({ page }) => {
    await openEditor(page);

    const a = { id: 11, x: 100, y: 100 };
    const b = { id: 12, x: 200, y: 100 };

    await touch(page, 'start', [a], [a]);
    await touch(page, 'start', [b], [a, b]);
    await touch(
        page,
        'move',
        [
            { ...a, x: 50 },
            { ...b, x: 250 }
        ],
        [
            { ...a, x: 50 },
            { ...b, x: 250 }
        ]
    );

    await expect(camera(page)).toHaveAttribute('transform', 'translate(-150,-100) scale(2)');

    await touch(
        page,
        'end',
        [
            { ...a, x: 50 },
            { ...b, x: 250 }
        ],
        []
    );
    await expect(shapes(page)).toHaveCount(0);
});

test('a pinch replaces an unmoved touch drawing and never commits it', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');

    const a = { id: 21, x: 100, y: 100 };
    const b = { id: 22, x: 200, y: 200 };

    await touch(page, 'start', [a], [a]);
    await touch(page, 'start', [b], [a, b]);
    await touch(page, 'move', [{ ...b, x: 300, y: 300 }], [a, { ...b, x: 300, y: 300 }]);
    await touch(page, 'end', [a, { ...b, x: 300, y: 300 }], []);

    await expect(camera(page)).not.toHaveAttribute('transform', 'translate(0,0) scale(1)');
    await expect(shapes(page)).toHaveCount(0);
});

test('a second contact cannot turn a moving touch drag into a pinch', async ({ page }) => {
    await openEditor(page);
    await selectTool(page, 'Draws a rectangle or square');

    const a = { id: 31, x: 100, y: 100 };
    const b = { id: 32, x: 300, y: 300 };

    await touch(page, 'start', [a], [a]);
    await touch(page, 'move', [{ ...a, x: 150, y: 150 }], [{ ...a, x: 150, y: 150 }]);
    await touch(page, 'start', [b], [{ ...a, x: 150, y: 150 }, b]);
    await touch(
        page,
        'move',
        [{ ...b, x: 400, y: 400 }],
        [
            { ...a, x: 150, y: 150 },
            { ...b, x: 400, y: 400 }
        ]
    );
    await touch(page, 'end', [b], [{ ...a, x: 150, y: 150 }]);
    await touch(page, 'end', [{ ...a, x: 200, y: 180 }], []);

    await expect(camera(page)).toHaveAttribute('transform', 'translate(0,0) scale(1)');
    await expect(shapes(page)).toHaveCount(1);
    await expect(firstShape(page).locator('rect[data-cy]')).toHaveAttribute('width', '100');
});

for (const lifted of ['first', 'second'] as const) {
    test(`the remaining contact stays inert after the ${lifted} pinch contact lifts`, async ({
        page
    }) => {
        await openEditor(page);
        await selectTool(page, 'Draws a rectangle or square');

        const a = { id: 41, x: 100, y: 100 };
        const b = { id: 42, x: 200, y: 100 };
        const spread = { ...b, x: 300 };

        await touch(page, 'start', [a], [a]);
        await touch(page, 'start', [b], [a, b]);
        await touch(page, 'move', [spread], [a, spread]);

        const zoomed = await camera(page).getAttribute('transform');
        const [up, remaining] = lifted === 'first' ? [a, spread] : [spread, a];
        const moved = { ...remaining, x: 20, y: 300 };

        await touch(page, 'end', [up], [remaining]);
        await touch(page, 'move', [moved], [moved]);
        await touch(page, 'end', [moved], []);

        await expect(camera(page)).toHaveAttribute('transform', zoomed ?? '');
        await expect(shapes(page)).toHaveCount(0);

        // Once every contact is up, a new touch draws again.
        await selectTool(page, 'Draws a rectangle or square');
        await touch(page, 'start', [{ id: 43, x: 100, y: 100 }], [{ id: 43, x: 100, y: 100 }]);
        await touch(page, 'end', [{ id: 43, x: 150, y: 130 }], []);
        await expect(shapes(page)).toHaveCount(1);
    });
}
