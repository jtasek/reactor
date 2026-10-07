import { expect, test } from '@playwright/test';
import { drawRect, openEditor } from './support/editor';

test('the document info panel follows the document’s changes', async ({ page }) => {
    await openEditor(page, ['Document Info']);

    const field = (name: string) =>
        page
            .getByRole('row')
            .filter({ has: page.getByRole('cell', { name: `${name}:`, exact: true }) });

    await expect(field('name')).toContainText('document-1');
    await expect(field('shapesIds')).toContainText('0 item(s)');

    await drawRect(page, { x: 100, y: 100 }, { x: 140, y: 140 });
    await expect(field('shapesIds')).toContainText('1 item(s)');
    await expect(field('locked')).toContainText('false');
});
