import { expect, test } from '@playwright/test';
import { drawRect, openEditor, pointer, selectTool } from './support/editor';

const frames = (page: Parameters<typeof openEditor>[0]) =>
    page.locator('svg#surface #frames > [data-frame]');
async function drawFrame(page: Parameters<typeof openEditor>[0]) {
    await selectTool(page, 'Draw a frame');
    await pointer(page, 'pointerdown', { x: 150, y: 140 });
    await pointer(page, 'pointermove', { x: 550, y: 440 });
    await pointer(page, 'pointerup', { x: 550, y: 440 });
    await expect(frames(page)).toHaveCount(1);
}

test('creates a frame, edits its name and box in Inspector, and keeps it after reload', async ({
    page
}) => {
    await openEditor(page, ['Inspector', 'Explorer']);
    await drawFrame(page);
    await expect(frames(page).first()).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Frame name', { exact: true }).fill('Home');
    await page.getByLabel('Frame name', { exact: true }).press('Enter');
    await page.getByLabel('Frame width', { exact: true }).fill('390');
    await page.getByLabel('Frame width', { exact: true }).press('Enter');
    await page.getByLabel('Frame height', { exact: true }).fill('844');
    await page.getByLabel('Frame height', { exact: true }).press('Enter');
    await expect(frames(page).locator('text')).toHaveText('Home');
    await expect(frames(page).locator('rect').last()).toHaveAttribute('width', '390');
    await page.getByLabel('Frame x', { exact: true }).fill('80');
    await page.getByLabel('Frame x', { exact: true }).press('Enter');
    await page.getByLabel('Frame y', { exact: true }).fill('380');
    await page.getByLabel('Frame y', { exact: true }).press('Enter');
    await page.screenshot({ path: '/tmp/reactor-frame-editor.png' });
    await page.reload();
    await expect(frames(page)).toHaveCount(1);
    await expect(frames(page).locator('text')).toHaveText('Home');
    await expect(frames(page).first()).toHaveAttribute('aria-pressed', 'false');
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Home', exact: true })
        .click();
    await expect(page.getByLabel('Frame width', { exact: true })).toHaveValue('390');
    await page.setViewportSize({ width: 600, height: 850 });
    await page.screenshot({ path: '/tmp/reactor-frame-editor-narrow.png' });
});

test('selects by the canvas label and moves/resizes with cancelable owning-pointer gestures', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawFrame(page);
    await pointer(page, 'pointerdown', { x: 150, y: 140, target: '[data-frame] text' });
    await pointer(page, 'pointermove', { x: 200, y: 190 });
    await pointer(page, 'pointercancel', { x: 200, y: 190 });
    await expect(page.getByLabel('Frame x', { exact: true })).toHaveValue('150');
    await pointer(page, 'pointerdown', {
        x: 150,
        y: 240,
        target: '#frame-grips [data-frame-id]'
    });
    await pointer(page, 'pointermove', { x: 200, y: 290 });
    await pointer(page, 'pointerup', { x: 200, y: 290 });
    await expect(page.getByLabel('Frame x', { exact: true })).toHaveValue('200');
    await pointer(page, 'pointerdown', {
        x: 600,
        y: 490,
        target: '[data-frame] [data-type="bottomRight"]'
    });
    await pointer(page, 'pointermove', { x: 650, y: 550 });
    await pointer(page, 'pointerup', { x: 650, y: 550 });
    await expect(page.getByLabel('Frame width', { exact: true })).toHaveValue('450');
    await expect(page.getByLabel('Frame height', { exact: true })).toHaveValue('360');
});

test('leaves artwork independently selectable and does not select the frame from its empty interior', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawFrame(page);
    await drawRect(page, { x: 200, y: 200 }, { x: 250, y: 240 });
    await pointer(page, 'pointerdown', { x: 220, y: 220 });
    await pointer(page, 'pointerup', { x: 220, y: 220 });
    await expect(page.getByLabel('Frame name', { exact: true })).toHaveCount(0);
    await expect(frames(page).first()).toHaveAttribute('aria-pressed', 'false');
    await pointer(page, 'pointerdown', { x: 400, y: 300 });
    await pointer(page, 'pointerup', { x: 400, y: 300 });
    await expect(frames(page).first()).toHaveAttribute('aria-pressed', 'false');
    await expect(frames(page).locator('rect').last()).toHaveAttribute('width', '400');
});

test('lets a shape on a frame edge take the press, and the edge alone grab the frame', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawFrame(page);
    await drawRect(page, { x: 150, y: 140 }, { x: 550, y: 340 });
    const box = (await page.locator('svg#surface').boundingBox())!;
    const press = async (x: number, y: number) => {
        await page.mouse.move(box.x + x, box.y + y);
        await page.mouse.down();
        await page.mouse.up();
    };

    await press(152, 240);
    await expect(frames(page).first()).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByLabel('Frame name', { exact: true })).toHaveCount(0);
    await press(152, 400);
    await expect(frames(page).first()).toHaveAttribute('aria-pressed', 'true');
});

test('supports keyboard selection, nudging, clone, delete and undo without changing artwork', async ({
    page
}) => {
    await openEditor(page, ['Inspector']);
    await drawFrame(page);
    await frames(page).first().focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByLabel('Frame x', { exact: true })).toHaveValue('160');
    await page.keyboard.press('ControlOrMeta+d');
    await expect(frames(page)).toHaveCount(2);
    await page.keyboard.press('Delete');
    await expect(frames(page)).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(frames(page)).toHaveCount(2);
});

test('canceling creation leaves no frame and a frame-only document has a visible thumbnail', async ({
    page
}) => {
    await openEditor(page);
    await selectTool(page, 'Draw a frame');
    await pointer(page, 'pointerdown', { x: 150, y: 140 });
    await pointer(page, 'pointermove', { x: 550, y: 440 });
    await pointer(page, 'pointercancel', { x: 550, y: 440 });
    await expect(frames(page)).toHaveCount(0);
    await drawFrame(page);
    await page.goto('/documents');
    await expect(page.getByRole('img', { name: /^Preview of/ }).first()).toBeVisible();
});

test('copies, cuts and pastes a frame using the native keyboard clipboard flow', async ({
    page
}) => {
    await openEditor(page);
    await drawFrame(page);
    await frames(page).first().focus();
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');
    await expect(frames(page)).toHaveCount(2);
    await page.keyboard.press('ControlOrMeta+x');
    await expect(frames(page)).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+v');
    await expect(frames(page)).toHaveCount(2);
});

test('keeps selected resize handles above overlapping frame boundaries', async ({ page }) => {
    await openEditor(page, ['Inspector']);
    await drawFrame(page);
    await selectTool(page, 'Draw a frame');
    await pointer(page, 'pointerdown', { x: 150, y: 140 });
    await pointer(page, 'pointermove', { x: 550, y: 440 });
    await pointer(page, 'pointerup', { x: 550, y: 440 });
    const selected = frames(page).filter({ has: page.locator('circle') });
    const id = await selected.getAttribute('data-frame');
    await expect(frames(page).last()).toHaveAttribute('data-frame', id!);
    const surface = await page.locator('svg#surface').boundingBox();
    await page.mouse.move(surface!.x + 550, surface!.y + 440);
    await page.mouse.down();
    await page.mouse.move(surface!.x + 600, surface!.y + 490);
    await page.mouse.up();
    await expect(selected).toHaveAttribute('data-frame', id!);
    await expect(page.getByLabel('Frame width', { exact: true })).toHaveValue('450');
});
