import { expect, test } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';

const COUNT = 150;

test.beforeEach(async ({ page }) => {
    const shapes = Array.from({ length: COUNT }, (_, index) =>
        createShape({
            type: 'rectangle',
            name: `Box ${index + 1}`,
            order: `a${String(index).padStart(3, '0')}`,
            position: { x: 300 + (index % 15) * 30, y: 150 + Math.floor(index / 15) * 30 },
            size: { width: 20, height: 20 },
            selected: false
        })
    );
    const document = createDocument({
        shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape]))
    });
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });

    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.goto('/');
    await page.getByRole('button', { name: 'More panels' }).click();
    await page.getByRole('checkbox', { name: 'Explorer', exact: true }).check();
});

test('a long Explorer list draws the rows near the view and the rest as they are scrolled to', async ({
    page
}) => {
    const explorer = page.getByRole('region', { name: 'Explorer' });
    const boxes = explorer.getByRole('button', { name: /^Box \d+$/ });

    await expect(boxes.first()).toBeVisible();

    const list = boxes.first().locator('xpath=ancestor::ul[1]');
    const rows = list.locator(':scope > li');
    const first = rows.first();
    const last = rows.last();

    // Every shape has a row, and only those near the view are drawn.
    await expect(rows).toHaveCount(COUNT);
    expect(await boxes.count()).toBeLessThan(COUNT);
    await expect(first.getByRole('button', { name: /^Box \d+$/ })).toBeVisible();
    await expect(last).toHaveAttribute('aria-hidden', 'true');
    await expect(last.getByRole('button')).toHaveCount(0);

    // A drawn row says where it is in the whole list.
    await expect(first).toHaveAttribute('aria-posinset', '1');
    await expect(first).toHaveAttribute('aria-setsize', String(COUNT));

    // Rows not drawn keep their height, so the list is as long as all of its rows.
    const heights = await rows.evaluateAll((items) => [
        ...new Set(items.map((item) => item.getBoundingClientRect().height))
    ]);

    expect(heights).toHaveLength(1);

    await last.evaluate((row) => row.scrollIntoView());

    const lastBox = last.getByRole('button', { name: /^Box \d+$/ });

    await expect(lastBox).toBeVisible();
    await expect(last).toHaveAttribute('aria-posinset', String(COUNT));
    await expect(first).toHaveAttribute('aria-hidden', 'true');

    // A row scrolled to works like any other.
    await lastBox.click();
    await expect(lastBox).toHaveAttribute('aria-pressed', 'true');
});
