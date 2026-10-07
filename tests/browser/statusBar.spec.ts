import { expect, test } from '@playwright/test';
import { drawRect, openEditor, pointer } from './support/editor';

test('the status bar’s slots follow the document, the selection, the pointer and the camera', async ({
    page
}) => {
    await openEditor(page, ['Menu Bar']);

    const slot = (name: string) => page.locator(`#status-${name}`);

    // The slots' ids are their own, apart from the canvas's tool and camera layers.
    await expect(page.locator('[id="tools"]')).toHaveCount(1);
    await expect(page.locator('[id="camera"]')).toHaveCount(1);

    await expect(slot('message')).toHaveText('document-1');
    await expect(slot('selection')).toHaveText('selection: [0]');

    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });
    await expect(slot('selection')).toHaveText('selection: [1]');

    await pointer(page, 'pointermove', { x: 300, y: 200 });
    await expect(slot('mouse')).toHaveText('mouse: [300, 200]');

    await pointer(page, 'pointerdown', { x: 300, y: 200 });
    await pointer(page, 'pointerup', { x: 300, y: 200 });
    await expect(slot('selection')).toHaveText('selection: [0]');

    await page.locator('svg#surface').hover();
    await page.mouse.wheel(40, 80);
    await expect(slot('camera')).toHaveText('camera: [-40, -80, 1]');

    await page.getByRole('link', { name: 'Documents' }).dispatchEvent('click');
    await page.getByRole('button', { name: 'New document', exact: true }).click();
    await expect(slot('message')).toHaveText('document-2');
});
