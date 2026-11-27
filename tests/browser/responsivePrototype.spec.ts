import {
    expectPrototypeSetting,
    openDeviceMenu,
    setPrototypeSetting
} from './support/prototypeControls';
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
    await expectPrototypeSetting(page, 'Prototype width', '320');
    await expectPrototypeSetting(page, 'Prototype Theme', 'dark');
    await expect(runtime.locator('svg')).toHaveAttribute('width', '320');
    const input = runtime.getByRole('textbox', { name: 'Your name', exact: true });
    await input.fill('Ada');
    await width(page, '800');
    await expect(runtime.locator('svg')).toHaveAttribute('viewBox', '1000 0 800 480');
    await expect(input).toHaveValue('Ada');
    await expect(runtime.getByLabel('Preview width')).toHaveCount(0);
    await expect(runtime.getByLabel('Preview page')).toHaveCount(0);
    await expect(runtime.getByLabel('Preview layout')).toHaveCount(0);
    const bounds = await runtime.locator('svg').boundingBox();
    const stage = await page.locator('iframe').boundingBox();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - stage!.x - stage!.width / 2)).toBeLessThan(2);
    await expect(runtime.getByRole('button', { name: 'Restart preview' })).toHaveCount(0);
    await width(page, '0');
    await expectPrototypeSetting(page, 'Prototype width', '800');
    await setPrototypeSetting(page, 'Prototype height', '900');
    await runtime.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
    await expect(page.getByLabel('Preview page')).toHaveValue('details');
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
    await page.getByLabel('Preview page').selectOption('home');
    await expect(input).toHaveValue('Ada');
    await page.getByLabel('Preview layout').selectOption('"home"');
    await expect(runtime.locator('svg')).toHaveAttribute('viewBox', '0 0 800 900');
    await width(page, '700');
    await expect(runtime.locator('svg')).toHaveAttribute('viewBox', '0 0 700 900');
    await width(page, '800');
    await expect(input).toHaveValue('Ada');
    await page.screenshot({ path: 'test-results/prototype-wide.png' });
    await page.setViewportSize({ width: 600, height: 850 });
    const devices = await openDeviceMenu(page);
    await expect(devices.getByLabel('Prototype width', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/prototype-narrow.png' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
    await expect(page.getByLabel('Preview page')).toHaveValue('home');
    await expect(input).toHaveValue('Your name');
    await expect(runtime.locator('svg')).toHaveAttribute('viewBox', '1000 0 800 900');
    await input.fill('Grace');
    await setPrototypeSetting(page, 'Start page', 'details');
    await expect(page.getByLabel('Preview page')).toHaveValue('details');
    await page.getByRole('link', { name: 'Canvas', exact: true }).click();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(
        page.locator('[data-panel="inspector"]').getByLabel('Shown width', { exact: true })
    ).toHaveValue('320');
    await page.getByRole('link', { name: 'Open prototype' }).click();
    await expect(input).toHaveValue('Your name');
    await expectPrototypeSetting(page, 'Prototype Theme', 'dark');
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
    await expectPrototypeSetting(second, 'Prototype width', '320');
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
    await page.getByRole('button', { name: 'More for Details', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Start here', exact: true }).click();
    await page.getByRole('link', { name: 'Play prototype', exact: true }).click();
    await expectPrototypeSetting(page, 'Start page', 'details');
    await expect(page.getByLabel('Preview page')).toHaveValue('details');
    await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
    await expect(page.getByLabel('Preview page')).toHaveValue('details');
});

test('keeps setup out of the player, restores focus and preserves input when changing devices', async ({
    page
}) => {
    await seed(page);
    await page.goto('/prototype');
    const runtime = player(page);
    await expect(page.getByRole('dialog', { name: 'Prototype settings' })).not.toBeVisible();
    await expect(runtime.getByRole('navigation', { name: 'Preview controls' })).toHaveCount(0);
    await expect(page.getByLabel('Preview page')).toHaveValue('home');
    const bar = page.locator('main > header');
    const controls = page.getByRole('group', { name: 'Prototype controls' });
    await expect(controls.getByLabel('Preview page')).toBeVisible();
    await expect(controls.getByLabel('Preview layout')).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Device', exact: true })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Restart prototype' })).toBeVisible();
    // The bar holds the page's own actions as buttons, with Flow as the main one.
    await expect(bar.getByRole('button', { name: 'Share prototype', exact: true })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Download prototype' })).toBeVisible();
    await expect(bar.getByRole('link', { name: 'Flow', exact: true })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'More', exact: true })).toHaveCount(0);
    const settings = bar.getByRole('button', { name: 'Prototype settings' });
    await settings.click();
    await page
        .getByRole('dialog', { name: 'Prototype settings' })
        .getByRole('button', { name: 'Done' })
        .click();
    await expect(settings).toBeFocused();
    const restart = controls.getByRole('button', { name: 'Restart prototype' });
    await restart.focus();
    await page.keyboard.press('Enter');
    await expect(restart).toBeFocused();
    const input = runtime.getByRole('textbox', { name: 'Your name', exact: true });
    await input.fill('Ada');
    await page.screenshot({ path: 'test-results/prototype-header-wide.png' });
    const device = controls.getByRole('button', { name: 'Device', exact: true });
    let devices = await openDeviceMenu(page);
    await expect(devices.getByLabel('Search devices')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(device).toBeFocused();
    devices = await openDeviceMenu(page);
    await devices.getByRole('button', { name: 'Laptop 1280 × 800' }).click();
    await expect(devices).toBeHidden();
    await expect(runtime.locator('svg')).toHaveAttribute('width', '1280');
    // Desktops are shown without a device frame, phones and tablets in one unless it is off.
    const frame = runtime.locator('html');
    await expect(frame).toHaveAttribute('data-frame', 'none');
    await expect(input).toHaveValue('Ada');
    await expect(device).toContainText('Laptop');
    devices = await openDeviceMenu(page);
    await devices.getByRole('button', { name: 'iPhone 15 393 × 852' }).click();
    await expect(input).toHaveValue('Ada');
    await expect(device).toContainText('iPhone 15');
    await expect(frame).toHaveAttribute('data-frame', 'phone');
    devices = await openDeviceMenu(page);
    await devices.getByLabel('Show device frame').uncheck();
    await expect(frame).toHaveAttribute('data-frame', 'none');
    await devices.getByLabel('Show device frame').check();
    await page.keyboard.press('Escape');
    await expect(frame).toHaveAttribute('data-frame', 'phone');
    await expect(page.getByRole('region', { name: 'Prototype settings' })).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 740 });
    await expect(page.getByLabel('Preview page')).toBeInViewport({ ratio: 1 });
    await expect(device).toBeInViewport({ ratio: 1 });
    await expect(restart).toBeInViewport({ ratio: 1 });
    await expect(settings).toBeInViewport({ ratio: 1 });
    await expect(bar.getByRole('link', { name: 'Flow', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(controls.getByLabel('Preview layout')).toBeInViewport({ ratio: 1 });
    for (const element of [bar, controls]) {
        expect(await element.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
    await page.screenshot({ path: 'test-results/prototype-phone.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('link', { name: 'Flow', exact: true }).click();
    // Flow has no side editor: one menu, opened from the row, holds every choice.
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.locator('[data-flow-control="next"]').click();
    const menu = page.getByRole('menu', { name: 'Link from Continue button', exact: true });
    await expect(menu.getByRole('menuitemradio', { name: 'Home', exact: true })).toBeVisible();
    await expect(menu.getByRole('menuitemradio', { name: 'Always', exact: true })).toHaveCount(0);
    await menu.getByRole('menuitem', { name: /^Shown/ }).click();
    await expect(menu.getByRole('menuitemradio', { name: 'Always', exact: true })).toHaveAttribute(
        'aria-checked',
        'true'
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-flow-control="next"]')).toBeFocused();
    await expect(page.getByRole('menu')).toHaveCount(0);
});

test('keeps navigation in an older runtime without sending unsupported player commands', async ({
    page
}) => {
    await seed(page);
    await page.route('http://127.0.0.1:4194/?player=prototype', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: `<html><body><label>Page <select aria-label="Preview page"><option>Home</option></select></label><p></p><script>
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
    await expect(page.getByLabel('Preview page')).toBeDisabled();
    await expect(player(page).getByText('Drawing received')).toBeVisible();
    await expect(player(page).getByLabel('Preview page')).toBeVisible();
    await expect(page.getByLabel('Preview page')).toHaveCount(0);
    await expect(player(page).getByText('Unsupported command')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Prototype settings' })).toBeVisible();
});

test('picks the prototype size from phones, tablets and desktops, upright or turned', async ({
    page
}) => {
    await seed(page);
    await page.goto('/prototype');
    const runtime = player(page);
    const device = page.getByRole('button', { name: 'Device', exact: true });
    const landscape = page.getByRole('button', { name: 'Landscape', exact: true });

    let menu = await openDeviceMenu(page);
    await menu
        .getByRole('group', { name: 'Tablets' })
        .getByRole('button', { name: 'iPad Air 820 × 1180' })
        .click();
    await expect(device).toContainText('iPad Air');
    await expect(device).toContainText('820 × 1180');

    await landscape.click();
    await expect(landscape).toHaveAttribute('aria-pressed', 'true');
    await expect(device).toContainText('1180 × 820');
    menu = await openDeviceMenu(page);
    await expect(menu.getByRole('button', { name: 'iPad Air 1180 × 820' })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await expect(menu.getByLabel('Prototype width', { exact: true })).toHaveValue('1180');

    await menu.getByLabel('Search devices').fill('iphone 15');
    await expect(menu.getByRole('group', { name: 'Tablets' })).toHaveCount(0);
    await menu.getByRole('button', { name: 'iPhone 15 852 × 393' }).click();
    await landscape.click();
    await expect(landscape).toHaveAttribute('aria-pressed', 'false');
    await expect(device).toContainText('393 × 852');

    menu = await openDeviceMenu(page);
    await menu.getByLabel('Search devices').fill('watch');
    await expect(menu.getByText('No device matches “watch”.')).toBeVisible();
    await menu.getByLabel('Prototype width', { exact: true }).fill('500');
    await menu.getByLabel('Prototype width', { exact: true }).press('Tab');
    await expect(menu.getByLabel('Prototype height', { exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(device).toContainText('Custom size');
    await expect(device).toContainText('500 × 852');
    await expect(runtime.locator('svg')).toHaveAttribute('width', '500');

    menu = await openDeviceMenu(page);
    await menu.getByRole('button', { name: 'Desktop 1440 × 900' }).click();
    await expect(landscape).toBeDisabled();
    await expect(runtime.locator('svg')).toHaveAttribute('width', '1440');
});
