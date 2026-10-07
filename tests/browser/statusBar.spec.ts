import { expect, test } from '@playwright/test';
import { drawRect, openEditor, pointer } from './support/editor';

test('the status bar’s slots follow the document, the selection and the pointer', async ({
    page
}) => {
    await openEditor(page);

    const slot = (name: string) => page.locator(`#${name}`);

    await expect(slot('message')).toHaveText('document-1');
    await expect(slot('selection')).toHaveText('selection: [0]');

    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });
    await expect(slot('selection')).toHaveText('selection: [1]');

    await pointer(page, 'pointermove', { x: 300, y: 200 });
    await expect(slot('mouse')).toHaveText('mouse: [300, 200]');

    await pointer(page, 'pointerdown', { x: 300, y: 200 });
    await pointer(page, 'pointerup', { x: 300, y: 200 });
    await expect(slot('selection')).toHaveText('selection: [0]');
});
