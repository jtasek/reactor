import { expect, test, type Page } from '@playwright/test';
import { createDocument, createShape, createGroup, createComponent } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { expectPlacedCoordinate, openEditor, pointer } from './support/editor';

async function openContainer(
    page: Page,
    kind: 'group' | 'component',
    restriction?: 'locked' | 'stack'
) {
    const shapes = [120, 180].map((x, i) =>
        createShape({
            type: 'rectangle',
            name: `Part ${i + 1}`,
            order: `a${i}`,
            position: { x, y: 110 },
            size: { width: 40, height: 40 },
            fill: '#888888',
            parentFrameId: 'home',
            selected: false
        })
    );
    const container = {
        id: 'container',
        name: 'Card',
        shapesIds: shapes.map((shape) => shape.id),
        locked: restriction === 'locked'
    };
    const document = createDocument({
        id: 'view-container-handles',
        shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
        ...(kind === 'group'
            ? { groups: { container: createGroup(container) } }
            : { components: { container: createComponent(container) } }),
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
                              direction: 'row' as const,
                              gap: 10,
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
        }
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page);
    await page.getByRole('button', { name: 'More panels' }).click();

    return {
        desktop: page.locator('#screen-views > [data-screen-view="desktop"]'),
        mobile: page.locator('#screen-views > [data-screen-view="home:view"]'),
        selector: `[data-${kind}-selection="container"]`
    };
}

for (const kind of ['group', 'component'] as const) {
    test(`${kind}: one handle set resizes and rotates shared artwork in both views`, async ({
        page
    }) => {
        const { desktop, mobile, selector } = await openContainer(page, kind);
        await desktop.locator('[data-cy="Part 1"]').click();
        const selection = desktop.locator(selector);
        await expect(selection.locator('[data-handle]')).toHaveCount(9);
        await expect(desktop.locator('[data-shape-id] [data-handle]')).toHaveCount(0);
        const corner = selection.locator('[data-type="bottomRight"]');
        await expectPlacedCoordinate(corner, 'cx', '620');
        await expectPlacedCoordinate(corner, 'cy', '370');
        const box = (await corner.boundingBox())!;
        const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + 100, from.y + 40, { steps: 5 });
        await page.mouse.up();
        for (const view of [desktop, mobile]) {
            await expect(view.locator('[data-cy="Part 1"]')).toHaveAttribute('width', '80');
            await expect(view.locator('[data-cy="Part 2"]')).toHaveAttribute('width', '80');
        }
        // Approach from outside the selection so its floating menu stays faded out.
        await page.mouse.move(1100, 700);
        const rotate = selection.locator('[data-type="rotate"]');
        const rotateBox = (await rotate.boundingBox())!;
        await page.mouse.move(
            rotateBox.x + rotateBox.width / 2,
            rotateBox.y + rotateBox.height / 2
        );
        await page.mouse.down();
        const surface = (await page.locator('svg#surface').boundingBox())!;
        await page.mouse.move(surface.x + 720, surface.y + 370, { steps: 5 });
        await page.mouse.up();
        await expect(selection).toHaveAttribute('transform', /^rotate\(90 /);
        await expect(mobile.locator(selector)).toHaveAttribute('transform', /^rotate\(90 /);
        await expect(
            page.locator(`#${kind === 'group' ? 'group' : 'component'}-selections ${selector}`)
        ).toHaveCount(0);
    });

    test(`${kind}: cancel restores geometry and handles work in a narrow Screen view`, async ({
        page
    }) => {
        const { mobile, selector } = await openContainer(page, kind);
        await page.setViewportSize({ width: 600, height: 800 });
        await mobile.locator('[data-cy="Part 1"]').click();
        const target = `#screen-views > [data-screen-view="home:view"] ${selector} [data-type="bottomRight"]`;
        await pointer(page, 'pointerdown', { x: 220, y: 150, target });
        await pointer(page, 'pointermove', { x: 320, y: 190 });
        await expect(mobile.locator('[data-cy="Part 1"]')).toHaveAttribute('width', '80');
        await pointer(page, 'pointercancel', { x: 320, y: 190 });
        await expect(mobile.locator('[data-cy="Part 1"]')).toHaveAttribute('width', '40');
        await expectPlacedCoordinate(
            mobile.locator(selector).locator('[data-type="bottomRight"]'),
            'cx',
            '220'
        );
    });

    for (const restriction of ['locked', 'stack'] as const) {
        test(`${kind}: ${restriction} containers stay selectable without transform handles`, async ({
            page
        }) => {
            const { desktop, selector } = await openContainer(page, kind, restriction);
            await desktop.locator('[data-cy="Part 1"]').click();
            await expect(desktop.locator(selector)).toBeVisible();
            await expect(desktop.locator('[data-handle]')).toHaveCount(0);
        });
    }
}
