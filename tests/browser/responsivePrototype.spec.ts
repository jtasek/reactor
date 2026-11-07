import { setPrototypeSetting } from './support/prototypeControls';
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
    await setPrototypeSetting(page, 'Prototype width', value);
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
    await expect(runtime.getByLabel('Preview screen')).toHaveCount(0);
    await expect(runtime.getByLabel('Preview layout')).toHaveCount(0);
    const bounds = await runtime.locator('svg').boundingBox();
    const stage = await page.locator('iframe').boundingBox();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - stage!.x - stage!.width / 2)).toBeLessThan(2);
    await expect(runtime.getByRole('button', { name: 'Restart preview' })).toHaveCount(0);
    await width(page, '0');
    await expect(page.getByLabel('Prototype width', { exact: true })).toHaveValue('800');
    await setPrototypeSetting(page, 'Prototype height', '900');
    await runtime.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
    await expect(page.getByLabel('Preview screen')).toHaveValue('details');
    await expect(runtime.locator('svg')).toHaveAttribute('height', '900');
    await expect(runtime.locator('text')).toHaveAttribute('fill', '#ddeeff');
    await expect(runtime.locator('text')).toHaveAttribute('font-size', '20');
    await setPrototypeSetting(page, 'Prototype MediaSize', 'xs');
    await expect(runtime.locator('text')).toHaveAttribute('font-size', '14');
    await width(page, '600');
    await expect(runtime.locator('text')).toHaveAttribute('font-size', '14');
    await setPrototypeSetting(page, 'Prototype MediaSize', '');
    await expect(runtime.locator('text')).toHaveAttribute('font-size', '20');
    await width(page, '800');
    await setPrototypeSetting(page, 'Prototype Theme', 'light');
    await expect(runtime.locator('text')).toHaveAttribute('fill', '#112233');
    await page.getByLabel('Preview screen').selectOption('home');
    await expect(input).toHaveValue('Ada');
    await page.getByLabel('Preview layout').selectOption('"home"');
    await expect(runtime.locator('svg')).toHaveAttribute('viewBox', '0 0 800 900');
    await width(page, '700');
    await expect(runtime.locator('svg')).toHaveAttribute('viewBox', '0 0 700 900');
    await width(page, '800');
    await expect(input).toHaveValue('Ada');
    await page.screenshot({ path: 'test-results/prototype-wide.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    await page.getByRole('button', { name: 'Prototype settings', exact: true }).click();
    await expect(page.getByLabel('Prototype width', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/prototype-narrow.png' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
    await expect(page.getByLabel('Preview screen')).toHaveValue('home');
    await expect(input).toHaveValue('Your name');
    await expect(runtime.locator('svg')).toHaveAttribute('viewBox', '1000 0 800 900');
    await input.fill('Grace');
    await setPrototypeSetting(page, 'Start screen', 'details');
    await expect(page.getByLabel('Preview screen')).toHaveValue('details');
    await page.getByRole('link', { name: 'Canvas', exact: true }).click();
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
    await expect(page.getByText('Showing the last valid preview.')).toBeVisible();
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
    await page.getByLabel('Start screen for reachability').selectOption('details');
    await page.getByRole('link', { name: 'Play prototype', exact: true }).click();
    await expect(page.getByLabel('Start screen')).toHaveValue('details');
    await expect(page.getByLabel('Preview screen')).toHaveValue('details');
    await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
    await expect(page.getByLabel('Preview screen')).toHaveValue('details');
});

test('keeps setup out of the player, restores settings focus and preserves input when changing presets', async ({
    page
}) => {
    await seed(page);
    await page.goto('/prototype');
    const runtime = player(page);
    const settings = page.getByRole('button', { name: 'Prototype settings', exact: true });
    await expect(page.getByRole('dialog', { name: 'Prototype settings' })).not.toBeVisible();
    await expect(runtime.getByRole('navigation', { name: 'Preview controls' })).toHaveCount(0);
    await expect(page.getByLabel('Preview screen')).toHaveValue('home');
    const header = page.locator('main > header');
    await expect(header.getByLabel('Preview screen')).toBeVisible();
    await expect(header.getByLabel('Preview layout')).toBeVisible();
    await expect(header.getByLabel('Viewport preset')).toBeVisible();
    await expect(header.getByRole('button', { name: 'Restart prototype' })).toBeVisible();
    await expect(
        header.getByRole('button', { name: 'Prototype settings', exact: true })
    ).toBeVisible();
    // Header buttons share a bottom edge with the labelled selects.
    const bottom = async (name: string) => {
        const box = await header.getByRole('button', { name, exact: true }).boundingBox();

        return Math.round(box!.y + box!.height);
    };
    expect(await bottom('Share prototype')).toBe(await bottom('Restart prototype'));
    const restart = header.getByRole('button', { name: 'Restart prototype' });
    await restart.focus();
    await page.keyboard.press('Enter');
    await expect(restart).toBeFocused();
    const input = runtime.getByRole('textbox', { name: 'Your name', exact: true });
    await input.fill('Ada');
    await page.screenshot({ path: 'test-results/prototype-header-wide.png' });
    await settings.click();
    await page.getByLabel('Prototype width', { exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(settings).toBeFocused();
    await page.getByLabel('Viewport preset').selectOption('desktop');
    await expect(runtime.locator('svg')).toHaveAttribute('width', '1280');
    await expect(input).toHaveValue('Ada');
    await page.getByLabel('Viewport preset').selectOption('mobile');
    await expect(input).toHaveValue('Ada');
    // Custom stays chosen, so the menu matches what the person picked.
    await page.getByLabel('Viewport preset').selectOption('custom');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByLabel('Viewport preset')).toHaveValue('custom');
    await page.getByLabel('Viewport preset').selectOption('mobile');
    await expect(page.getByLabel('Viewport preset')).toHaveValue('mobile');
    await expect(page.getByRole('region', { name: 'Prototype settings' })).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 740 });
    await expect(page.getByRole('button', { name: 'Restart prototype', exact: true })).toHaveText(
        'Restart'
    );
    await expect(page.getByLabel('Preview screen')).toBeInViewport({ ratio: 1 });
    await expect(page.getByLabel('Viewport preset')).toBeInViewport({ ratio: 1 });
    await expect(settings).toBeInViewport({ ratio: 1 });
    await expect(header.getByLabel('Preview layout')).toBeInViewport({ ratio: 1 });
    expect(await header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
    );
    // The wrapped phone header scrolls away instead of covering the player.
    await expect(header).toHaveCSS('position', 'relative');
    await page.screenshot({ path: 'test-results/prototype-phone.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('link', { name: 'Flow', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Selected control' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Connect to Home', exact: true })).toHaveCount(0);
    await page.locator('[data-flow-control="next"]').click();
    await expect(page.getByRole('complementary', { name: 'Selected control' })).toBeVisible();
    await expect(page.getByLabel('Prototype visibility')).toHaveCount(0);
    await page.getByRole('button', { name: 'Visibility and state…' }).click();
    await expect(page.getByLabel('Prototype visibility')).toBeVisible();
    await page.getByRole('button', { name: 'Deselect control' }).click();
    await expect(page.locator('[data-flow-control="next"]')).toBeFocused();
    await expect(page.getByRole('complementary', { name: 'Selected control' })).toHaveCount(0);
});

test('keeps navigation in an older runtime without sending unsupported player commands', async ({
    page
}) => {
    await seed(page);
    await page.route('http://127.0.0.1:4194/?player=prototype', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: `<html><body><label>Screen <select aria-label="Preview screen"><option>Home</option></select></label><p></p><script>
                window.addEventListener('message', (event) => {
                    const port = event.ports[0];
                    port.onmessage = (message) => {
                        if (message.data.type) {
                            document.body.textContent = 'Unsupported command';
                            return;
                        }
                        document.querySelector('p').textContent = 'Drawing received';
                    };
                    setTimeout(() => port.postMessage({type: 'ready', version: 3}), 1500);
                });
            </script></body></html>`
        })
    );
    await page.goto('/prototype');
    // Until the runtime answers, the picker holds its place so the toolbar doesn't shift.
    await expect(page.getByLabel('Preview screen')).toBeDisabled();
    await expect(player(page).getByText('Drawing received')).toBeVisible();
    await expect(player(page).getByLabel('Preview screen')).toBeVisible();
    await expect(page.getByLabel('Preview screen')).toHaveCount(0);
    await expect(player(page).getByText('Unsupported command')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Prototype settings', exact: true })
    ).toBeVisible();
});
