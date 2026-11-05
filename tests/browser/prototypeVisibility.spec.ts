import { expect, test } from '@playwright/test';

test('toggles help by keyboard, retains the variant choice and restores defaults on Reset', async ({
    page
}) => {
    await page.setViewportSize({ width: 1280, height: 1280 });
    await page.goto('/documents');
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await page
        .getByRole('button', { name: 'Use Inspector typography template', exact: true })
        .click();
    await page.getByRole('link', { name: 'Open prototype' }).click();
    const player = page.frameLocator('iframe[title="Application preview"]');
    const toggle = player.getByRole('button', { name: 'About these styles', exact: true });
    const help = player.getByText('Sentence case is easier to scan.', { exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(help).toHaveCount(0);
    await toggle.focus();
    await toggle.press('Enter');
    await expect(help).toBeVisible();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await player.getByRole('button', { name: 'Uppercase · Semibold', exact: true }).click();
    await expect(help).toBeVisible();
    await expect(player.getByText('PROPERTIES', { exact: true })).toHaveAttribute(
        'font-weight',
        '600'
    );
    await page.screenshot({ path: 'test-results/prototype-visibility.png', fullPage: true });
    await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
    await expect(help).toHaveCount(0);
    await expect(player.getByText('Properties', { exact: true })).toHaveAttribute(
        'font-weight',
        '500'
    );
    await toggle.click();
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('shared sessions isolate visibility and retain hidden input values until Reset', async ({
    page,
    context
}) => {
    const { buildInspectorTypography } = await import('src/templates/inspectorTypography');
    const { createDocument } = await import('src/app/factories');
    const { projectPreview } = await import('src/preview/project');
    const { PREVIEW_PROTOCOL_VERSION } = await import('src/preview/protocol');
    let sequence = 0;
    const drawing = projectPreview(
        createDocument(buildInspectorTypography(() => `sample-${++sequence}`)),
        {}
    );
    const help = drawing.screens[0].nodes.find((node) => node.visibility?.initial === false)!;
    help.control = {
        role: 'input',
        label: 'Help notes',
        value: '',
        x: 0,
        y: 0,
        width: 300,
        height: 32
    };
    await context.route('**/api/prototype-links/open', (route) =>
        route.fulfill({ json: { version: PREVIEW_PROTOCOL_VERSION, application: drawing } })
    );
    const url = `http://127.0.0.1:4194/share#${'a'.repeat(43)}`;
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto(url);
    const other = await context.newPage();
    await other.goto(url);
    const toggle = page.getByRole('button', { name: 'About these styles', exact: true });
    const input = page.getByRole('textbox', { name: 'Help notes', exact: true });
    await toggle.click();
    await input.fill('Keep this note');
    await toggle.click();
    await expect(input).toHaveCount(0);
    await expect(other.getByRole('textbox', { name: 'Help notes', exact: true })).toHaveCount(0);
    await toggle.press('Space');
    await expect(input).toHaveValue('Keep this note');
    await page.screenshot({ path: 'test-results/prototype-visibility-narrow.png', fullPage: true });
    await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
    await expect(input).toHaveCount(0);
    await toggle.click();
    await expect(input).toHaveValue('');
    await other.close();
});

test('authors and persists initial visibility in Inspector', async ({ page }) => {
    const { openEditor } = await import('./support/editor');
    await page.goto('/documents');
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await page
        .getByRole('button', { name: 'Use Inspector typography template', exact: true })
        .click();
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await openEditor(page, ['Inspector', 'Explorer']);
    const selectHelp = () =>
        page
            .getByRole('region', { name: 'Explorer', exact: true })
            .getByRole('button', { name: 'Inspector help', exact: true })
            .first()
            .click();
    await selectHelp();
    const visible = page.getByRole('combobox', { name: 'Prototype visibility', exact: true });
    await expect(visible.locator('option:checked')).toHaveText('Hidden at start');
    await visible.selectOption({ label: 'Shown at start' });
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await selectHelp();
    await expect(visible.locator('option:checked')).toHaveText('Shown at start');
    await visible.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/prototype-visibility-inspector.png' });
    await page.getByRole('link', { name: 'Open prototype' }).click();
    const player = page.frameLocator('iframe[title="Application preview"]');
    await expect(
        player.getByText('Sentence case is easier to scan.', { exact: true })
    ).toBeVisible();
});

test('closing a card from inside returns focus to the control that opened it', async ({
    page,
    context
}) => {
    const { buildInspectorTypography } = await import('src/templates/inspectorTypography');
    const { createDocument } = await import('src/app/factories');
    const { projectPreview } = await import('src/preview/project');
    const { PREVIEW_PROTOCOL_VERSION } = await import('src/preview/protocol');
    let sequence = 0;
    const drawing = projectPreview(
        createDocument(buildInspectorTypography(() => `sample-${++sequence}`)),
        {}
    );
    const help = drawing.screens[0].nodes.find((node) => node.visibility?.initial === false)!;
    help.children!.push({
        key: `${help.key}/close`,
        tag: 'g',
        attrs: {},
        children: [],
        control: {
            role: 'button',
            label: 'Close help',
            toggleVisibility: help.visibility!.key,
            x: 280,
            y: 0,
            width: 40,
            height: 24
        }
    });
    await context.route('**/api/prototype-links/open', (route) =>
        route.fulfill({ json: { version: PREVIEW_PROTOCOL_VERSION, application: drawing } })
    );
    await page.goto(`http://127.0.0.1:4194/share#${'a'.repeat(43)}`);
    const about = page.getByRole('button', { name: 'About these styles', exact: true });
    await about.focus();
    await about.press('Enter');
    const close = page.getByRole('button', { name: 'Close help', exact: true });
    await close.focus();
    await close.press('Enter');
    await expect(close).toHaveCount(0);
    await expect(about).toBeFocused();
    await expect(about).toHaveAttribute('aria-expanded', 'false');
});
