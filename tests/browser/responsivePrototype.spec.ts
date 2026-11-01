import { expect, test, type Page } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { prototypeDocument } from '../support/prototype';
import { responsiveVariantsDocument } from '../support/responsiveVariants';
import { openEditor } from './support/editor';

async function seed(page: Page, document = prototypeDocument()) {
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.setViewportSize({ width: 1440, height: 1000 });
}

async function width(page: Page, value: string) {
    await page.getByLabel('Prototype width', { exact: true }).fill(value);
    await page.getByLabel('Prototype width', { exact: true }).press('Tab');
}

const player = (page: Page) => page.frameLocator('iframe[title="Application preview"]');

test('launches from a view, carries viewport and modes across navigation and preserves compatible input through layout changes', async ({
    page
}) => {
    await seed(page);
    await openEditor(page, ['Inspector']);
    await page.getByRole('button', { name: 'More panels', exact: true }).click();
    await page.locator('#frames > [data-frame="view"]').press('Enter');
    expect(
        await page.evaluate(() =>
            performance
                .getEntriesByType('resource')
                .some((entry) => /\/prototype\.[^/]+\.js$/.test(entry.name))
        )
    ).toBe(false);
    await page.getByRole('link', { name: 'Open prototype' }).click();
    const runtime = player(page);
    await expect(page.getByLabel('Prototype width', { exact: true })).toHaveValue('320');
    await expect(page.getByLabel('Prototype Theme')).toHaveValue('dark');
    await expect(runtime.locator('svg')).toHaveAttribute('width', '320');
    const input = runtime.getByRole('textbox', { name: 'Your name', exact: true });
    await input.fill('Ada');
    await width(page, '800');
    await expect(runtime.locator('svg')).toHaveAttribute('viewBox', '1000 0 800 480');
    await expect(input).toHaveValue('Ada');
    await expect(runtime.getByLabel('Preview width')).toHaveCount(0);
    await expect(runtime.getByRole('button', { name: 'Reset preview' })).toHaveCount(0);
    await width(page, '0');
    await expect(page.getByLabel('Prototype width', { exact: true })).toHaveValue('800');
    await page.getByLabel('Prototype height').fill('900');
    await page.getByLabel('Prototype height').press('Tab');
    await runtime.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
    await expect(runtime.getByLabel('Preview screen')).toHaveValue('details');
    await expect(runtime.locator('svg')).toHaveAttribute('height', '900');
    await expect(runtime.locator('text')).toHaveAttribute('fill', '#ddeeff');
    await expect(runtime.locator('text')).toHaveAttribute('font-size', '20');
    await page.getByLabel('Prototype MediaSize').selectOption('xs');
    await expect(runtime.locator('text')).toHaveAttribute('font-size', '14');
    await width(page, '600');
    await expect(runtime.locator('text')).toHaveAttribute('font-size', '14');
    await page.getByLabel('Prototype MediaSize').selectOption('');
    await expect(runtime.locator('text')).toHaveAttribute('font-size', '20');
    await width(page, '800');
    await page.getByLabel('Prototype Theme').selectOption('light');
    await expect(runtime.locator('text')).toHaveAttribute('fill', '#112233');
    await runtime.getByLabel('Preview screen').selectOption('home');
    await expect(input).toHaveValue('Ada');
    await runtime.getByLabel('Preview layout').selectOption('"home"');
    await expect(runtime.locator('svg')).toHaveAttribute('viewBox', '0 0 800 900');
    await width(page, '700');
    await expect(runtime.locator('svg')).toHaveAttribute('viewBox', '0 0 700 900');
    await width(page, '800');
    await expect(input).toHaveValue('Ada');
    await page.screenshot({ path: 'test-results/prototype-wide.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(page.getByLabel('Prototype width', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/prototype-narrow.png' });
    await page.getByRole('button', { name: 'Reset prototype', exact: true }).click();
    await expect(runtime.getByLabel('Preview screen')).toHaveValue('home');
    await expect(input).toHaveValue('Your name');
    await expect(runtime.locator('svg')).toHaveAttribute('viewBox', '1000 0 800 900');
    await input.fill('Grace');
    await page.getByLabel('Start screen').selectOption('details');
    await expect(runtime.getByLabel('Preview screen')).toHaveValue('details');
    await page.getByRole('link', { name: 'Close prototype' }).click();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(
        page.locator('[data-panel="inspector"]').getByLabel('View width', { exact: true })
    ).toHaveValue('320');
    await page.getByRole('link', { name: 'Open prototype' }).click();
    await expect(input).toHaveValue('Your name');
    await expect(page.getByLabel('Prototype Theme')).toHaveValue('dark');
});

test('keeps simultaneous sessions independent and retains valid output through live invalid and valid edits', async ({
    page,
    context
}) => {
    await seed(page);
    await openEditor(page, ['Inspector', 'Explorer']);
    await page.getByRole('button', { name: 'More panels', exact: true }).click();
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.getByRole('link', { name: 'Open prototype' }).click();
    await player(page).getByRole('textbox', { name: 'Your name', exact: true }).fill('Ada');
    await width(page, '800');
    const second = await context.newPage();
    await second.goto('/prototype');
    await expect(second.getByLabel('Prototype width', { exact: true })).toHaveValue('320');
    await expect(
        player(second).getByRole('textbox', { name: 'Your name', exact: true })
    ).toHaveValue('Your name');
    const editor = await context.newPage();
    await openEditor(editor, ['Inspector', 'Explorer']);
    await editor.getByRole('button', { name: 'More panels', exact: true }).click();
    await editor
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Button', exact: true })
        .click();
    await editor.getByLabel('Role label', { exact: true }).selectOption('');
    await expect(page.getByText('Showing the last valid preview.')).toBeVisible();
    await expect(player(page).getByRole('textbox', { name: 'Your name', exact: true })).toHaveValue(
        'Ada'
    );
    await expect(
        page.getByRole('button', { name: 'Inspect Wide continue', exact: true })
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Inspect Wide continue', exact: true })
    ).toHaveAccessibleDescription(/^Wide continue: /);
    await editor.getByLabel('Role label', { exact: true }).selectOption('label');
    await expect(page.getByText('Showing the last valid preview.')).toHaveCount(0);
    await expect(player(page).getByRole('textbox', { name: 'Your name', exact: true })).toHaveValue(
        'Ada'
    );
    await editor.getByLabel('Role label', { exact: true }).selectOption('');
    await page.getByRole('button', { name: 'Inspect Wide continue', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
        page.locator('[data-panel="inspector"]').getByLabel('Name', { exact: true })
    ).toHaveValue('Wide continue');
    await second.close();
    await editor.close();
});

for (const explicit of [false, true]) {
    test(`Prototype ${explicit ? 'preserves explicit' : 'resolves automatic'} component variants`, async ({
        page
    }) => {
        const document = responsiveVariantsDocument();
        const button = document.shapes.button;
        if (explicit && button.type === 'instance') {
            button.variantId = 'wide';
            delete button.variantMode;
        }
        await seed(page, document);
        await page.goto('/prototype');
        const runtime = player(page);
        await width(page, '360');
        await expect(runtime.locator('svg text')).toHaveAttribute(
            'font-size',
            explicit ? '32' : '16'
        );
        await width(page, '800');
        await expect(runtime.locator('svg text')).toHaveAttribute('font-size', '32');
        await width(page, '360');
        await expect(runtime.locator('svg text')).toHaveAttribute(
            'font-size',
            explicit ? '32' : '16'
        );
        await expect(runtime.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
    });
}

test('opens the screen chosen in Flow only after an explicit player launch', async ({ page }) => {
    await seed(page);
    await page.goto('/flow');
    await expect(page.getByRole('heading', { name: 'Flow', exact: true })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.getByLabel('Check reachability from').selectOption('details');
    await page.getByRole('link', { name: 'Open prototype', exact: true }).click();
    await expect(page.getByLabel('Start screen')).toHaveValue('details');
    await expect(player(page).getByLabel('Preview screen')).toHaveValue('details');
    await page.getByRole('button', { name: 'Reset prototype', exact: true }).click();
    await expect(player(page).getByLabel('Preview screen')).toHaveValue('details');
});
