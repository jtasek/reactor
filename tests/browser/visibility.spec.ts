import { expect, test, type Page } from '@playwright/test';
import { SCHEMA_VERSION, type PersistedState } from 'src/app/services/documentStorage';
import { drawRect, handles, openEditor, pointer, shapes } from './support/editor';

const navBarList = (page: Page, name: string) =>
    page.locator('li', { has: page.getByRole('heading', { name, exact: true }) });

/** A saved document with one rectangle at (100, 100) inside a visible layer. */
function layeredDocument(): PersistedState {
    const metadata = {
        created: '2026-01-01T00:00:00.000Z',
        modified: '2026-01-01T00:00:00.000Z',
        createdBy: 'anonymous',
        modifiedBy: 'anonymous',
        locked: false
    };

    return {
        version: SCHEMA_VERSION,
        currentDocumentId: 'document',
        documents: {
            document: {
                ...metadata,
                id: 'document',
                author: 'anonymous',
                name: 'Layered',
                tags: [],
                camera: { scale: 1, position: { x: 0, y: 0 } },
                grid: { width: 10, height: 10, factor: 10, visible: true },
                shapes: {
                    box: {
                        ...metadata,
                        id: 'box',
                        name: 'Box',
                        type: 'rectangle',
                        visible: true,
                        order: 'a0',
                        rotation: 0,
                        position: { x: 100, y: 100 },
                        size: { width: 50, height: 50 }
                    }
                },
                groups: {},
                layers: {
                    layer: {
                        id: 'layer',
                        name: 'Layer',
                        locked: false,
                        visible: true,
                        shapesIds: ['box']
                    }
                },
                components: {},
                links: {},
                rulers: {}
            }
        }
    };
}

test('hiding a layer hides its shapes on the canvas and from presses', async ({ page }) => {
    await page.addInitScript(
        (raw) => localStorage.setItem('reactor', raw),
        JSON.stringify(layeredDocument())
    );
    await openEditor(page, ['Explorer', 'Navigation Bar']);
    await expect(shapes(page)).toHaveCount(1);

    const layers = navBarList(page, 'Layers');

    await layers.locator('[title="Hide"]').click();

    await expect(shapes(page)).toHaveCount(0);

    // Dragging where the hidden shape was must neither select nor move it.
    await pointer(page, 'pointerdown', { x: 120, y: 120 });
    await pointer(page, 'pointermove', { x: 160, y: 160 });
    await pointer(page, 'pointerup', { x: 160, y: 160 });

    await layers.locator('[title="Show"]').click();

    await expect(shapes(page)).toHaveCount(1);
    await expect(shapes(page).locator('rect[data-cy]')).toHaveAttribute('x', '100');
    await expect(handles(page)).toHaveCount(0);
});

test('a locked selected shape offers no resize or rotate handles', async ({ page }) => {
    await openEditor(page, ['Explorer', 'Navigation Bar']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    await expect(handles(page)).toHaveCount(9);

    await navBarList(page, 'Shapes').locator('[title="Lock"]').click();

    await expect(handles(page)).toHaveCount(0);
});
