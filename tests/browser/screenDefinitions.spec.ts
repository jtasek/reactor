import { expect, test } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { previewFixture } from '../support/preview';
import { openEditor, pointer, selectTool } from './support/editor';

const explorer = (page: Parameters<typeof openEditor>[0]) =>
    page.getByRole('region', { name: 'Explorer' });
const row = (page: Parameters<typeof openEditor>[0], name: string) =>
    explorer(page).getByRole('button', { name, exact: true });

test('creates an ordinary frame and explicitly makes it a screen on the shared canvas', async ({
    page
}) => {
    await openEditor(page, ['Inspector', 'Explorer']);
    await selectTool(page, 'Draw a frame');
    await pointer(page, 'pointerdown', { x: 300, y: 300 });
    await pointer(page, 'pointermove', { x: 600, y: 500 });
    await pointer(page, 'pointerup', { x: 600, y: 500 });
    await expect(page.getByLabel('Frame type', { exact: true })).toHaveValue('frame');
    await expect(row(page, 'Frame')).not.toHaveAttribute('aria-describedby');
    await page.getByLabel('Frame type', { exact: true }).selectOption('screen');
    await expect(row(page, 'Frame')).toHaveAccessibleDescription('1 Screen view Screen');
    await expect(page.getByLabel('View width', { exact: true })).toHaveValue('300');
    await expect(page.getByLabel('View height', { exact: true })).toHaveValue('200');
});

test('keeps multiple screens and ordinary frames visible, persists conversion, and diagnoses demoted navigation targets', async ({
    page
}) => {
    const document = previewFixture();
    document.frames.artboard = {
        ...document.frames.details,
        id: 'artboard',
        name: 'Artwork frame',
        kind: 'frame',
        position: { x: 800, y: 0 }
    };
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await openEditor(page, ['Inspector', 'Explorer']);
    await expect(page.locator('svg#surface #frames > [data-frame]')).toHaveCount(3);
    await expect(row(page, 'Home')).toHaveAccessibleDescription('1 Screen view Screen');
    await expect(row(page, 'Details')).toHaveAccessibleDescription('1 Screen view Screen');
    await expect(row(page, 'Artwork frame')).not.toHaveAttribute('aria-describedby');
    await row(page, 'Details').click();
    await page.getByLabel('Frame name', { exact: true }).fill('Checkout');
    await page.getByLabel('Frame name', { exact: true }).press('Enter');
    await page.getByLabel('Frame type', { exact: true }).selectOption('frame');
    await expect(row(page, 'Checkout')).not.toHaveAttribute('aria-describedby');
    await page.reload();
    await expect(row(page, 'Checkout')).not.toHaveAttribute('aria-describedby');
    await expect(page.locator('svg#surface #frames > [data-frame]')).toHaveCount(4);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(
        page.getByText('Continue button links to an unavailable screen', { exact: false })
    ).toBeVisible();
    const preview = page.frameLocator('iframe[title="Application preview"]');
    await expect(preview.getByLabel('Preview screen').locator('option')).toHaveCount(1);
    await row(page, 'Checkout').click();
    await page.getByLabel('Frame type', { exact: true }).selectOption('screen');
    await expect(preview.getByLabel('Preview screen').locator('option')).toHaveCount(2);
    await preview.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(preview.getByLabel('Preview screen')).toHaveValue('details');
    await expect(page.locator('svg#surface #frames > [data-frame]')).toHaveCount(3);
    await page.getByRole('button', { name: 'Close Preview', exact: true }).press('Enter');
    await page.screenshot({ path: '/tmp/reactor-screen-identity.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await row(page, 'Checkout · 320 px').click();
    await expect(page.getByLabel('Screen view properties')).toBeVisible();
    await page.screenshot({ path: '/tmp/reactor-screen-identity-narrow.png' });
});
