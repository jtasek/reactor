import { expect, test, type Page } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import type { Shape, ShapeInput } from 'src/app/types';
import { openEditor } from './support/editor';

/** Where screenshots of the box model go when SHOTS names a folder. */
const shots = process.env.SHOTS;

const item = (
    id: string,
    order: number,
    input: Partial<Shape> & Pick<ShapeInput, 'type'>
): [string, Shape] => [
    id,
    {
        ...createShape({
            order: `a${order}`,
            name: id,
            parentFrameId: 'card',
            layoutOrder: order,
            ...input
        } as ShapeInput & Pick<Shape, 'order' | 'name'>),
        id,
        selected: false
    }
];

test.use({ viewport: { width: 1440, height: 900 } });

async function seed(page: Page) {
    const shapes = Object.fromEntries([
        item('Title', 0, {
            type: 'text',
            position: { x: 0, y: 0 },
            value: 'Welcome back',
            fontSize: 24
        }),
        item('Email', 1, {
            type: 'rectangle',
            position: { x: 0, y: 0 },
            size: { width: 304, height: 44 },
            cornerRadius: 10,
            fill: '#f1f2f5',
            stroke: '#d9dbe0',
            borderWidth: 1
        }),
        item('Password', 2, {
            type: 'rectangle',
            position: { x: 0, y: 0 },
            size: { width: 304, height: 44 },
            cornerRadius: 10,
            fill: '#f1f2f5',
            stroke: '#d9dbe0',
            borderWidth: 1,
            borderStyle: 'dashed'
        }),
        item('Primary button', 3, {
            type: 'rectangle',
            position: { x: 0, y: 0 },
            size: { width: 304, height: 48 },
            cornerRadius: 12,
            fill: '#1a5ddb',
            stroke: '#0f45b0',
            borderWidth: 1,
            margin: { top: 24, right: 0, bottom: 8, left: 0 }
        })
    ]);
    const document = createDocument({
        id: 'box-model',
        camera: { position: { x: 0, y: 0 }, scale: 1 },
        frames: {
            card: {
                id: 'card',
                name: 'Sign in',
                kind: 'frame',
                visible: true,
                locked: false,
                position: { x: 1010, y: 150 },
                size: { width: 360, height: 420 },
                stack: {
                    direction: 'column',
                    gap: 12,
                    padding: 28,
                    paddingSides: { top: 32, right: 28, bottom: 28, left: 28 },
                    align: 'start'
                }
            }
        },
        shapes,
        shapesIds: Object.keys(shapes)
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Explorer', 'Inspector']);
    await page.getByRole('button', { name: 'More panels' }).click();
}

const select = (page: Page, name: string) =>
    page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name, exact: true })
        .first()
        .click();
const button = (page: Page) => page.locator('svg#surface rect[data-cy="Primary button"]');

test('a shape’s margin shows on the canvas, moves it in its stack and follows its grips', async ({
    page
}) => {
    await seed(page);
    // Padding 32, the title, two fields and three gaps of 12, then the button's own 24.
    const top = Number(await button(page).getAttribute('y'));
    await select(page, 'Primary button');

    const bands = page.locator('[data-spacing-bands="margin"]');
    await expect(bands).toBeVisible();
    await expect(bands.locator('text').first()).toHaveText('24');
    await expect(page.getByRole('spinbutton', { name: 'Margin top' })).toHaveValue('24');
    if (shots) {
        await page.locator('[data-spacing="margin"]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${shots}/shape-margin.png` });
    }

    // Down on the top grip makes the margin smaller, so the button moves up.
    const grip = page.getByLabel('Margin top', { exact: true }).and(page.locator('rect'));
    const box = (await grip.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 10, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByRole('spinbutton', { name: 'Margin top' })).toHaveValue('14');
    await expect.poll(async () => Number(await button(page).getAttribute('y'))).toBe(top - 10);
    // The drag undoes as one step.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByRole('spinbutton', { name: 'Margin top' })).toHaveValue('24');
    await expect.poll(async () => Number(await button(page).getAttribute('y'))).toBe(top);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(page.getByRole('spinbutton', { name: 'Margin top' })).toHaveValue('14');

    // Sides that differ show one field each; once they match, one field across and one down.
    await expect(page.getByRole('button', { name: 'Margin on each side' })).toBeDisabled();
    await page.getByRole('spinbutton', { name: 'Margin bottom' }).fill('14');
    await page.getByRole('spinbutton', { name: 'Margin bottom' }).press('Enter');
    await page.getByRole('button', { name: 'Margin on each side' }).click();
    await page.getByRole('spinbutton', { name: 'Margin down' }).fill('16');
    await page.getByRole('spinbutton', { name: 'Margin down' }).press('Enter');
    await expect(page.getByRole('spinbutton', { name: 'Margin down' })).toHaveValue('16');
    await expect(page.getByRole('spinbutton', { name: 'Margin across' })).toHaveValue('0');
    await expect.poll(async () => Number(await button(page).getAttribute('y'))).toBe(top - 8);
});

test('a border’s width and style edit how its outline is drawn', async ({ page }) => {
    await seed(page);
    await select(page, 'Primary button');
    const inspector = page.locator('[data-property="borderStyle"]');
    const style = inspector.getByRole('group', { name: 'Style' });
    await expect(style.getByRole('button', { name: 'Solid' })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await style.getByRole('button', { name: 'Dashed' }).click();
    await expect(style.getByRole('button', { name: 'Dashed' })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await page.locator('#property-borderWidth').fill('3');
    await page.locator('#property-borderWidth').press('Enter');
    await expect
        .poll(() => button(page).evaluate((node) => getComputedStyle(node).strokeDasharray))
        .toMatch(/9px,? 6px/);
    if (shots) {
        await inspector.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${shots}/border.png` });
    }
});

test('a stack’s padding shows by side and its grips change one side', async ({ page }) => {
    await seed(page);
    await page.getByRole('button', { name: 'Frame Sign in' }).focus();
    await page.keyboard.press('Enter');
    const bands = page.locator('[data-spacing-bands="padding"]');
    await expect(bands).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Padding top' })).toHaveValue('32');
    if (shots) {
        await page.locator('[data-spacing="padding"]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${shots}/stack-padding.png` });
    }

    const title = page.locator('svg#surface text[data-cy="Title"]');
    const before = Number(await title.getAttribute('y'));
    const grip = page.getByLabel('Padding top', { exact: true }).and(page.locator('rect'));
    const box = (await grip.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 8, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByRole('spinbutton', { name: 'Padding top' })).toHaveValue('40');
    await expect.poll(async () => Number(await title.getAttribute('y'))).toBe(before + 8);
    await expect(page.getByRole('spinbutton', { name: 'Padding left' })).toHaveValue('28');
});
