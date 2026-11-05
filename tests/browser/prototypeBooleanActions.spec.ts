import { expect, test } from '@playwright/test';

test('authors explicit Open/Close actions and complementary visibility, preserving reload and Reset', async ({
    page
}) => {
    const { openEditor } = await import('./support/editor');
    await page.goto('/documents');
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await page
        .getByRole('button', { name: 'Use Inspector typography template', exact: true })
        .click();
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await openEditor(page, ['Inspector', 'Explorer']);
    const select = (name: string) =>
        page
            .getByRole('region', { name: 'Explorer', exact: true })
            .getByRole('button', { name, exact: true })
            .first()
            .click();
    await select('Inspector help');
    await page.locator('summary', { hasText: 'Prototype states' }).click();
    await page.getByRole('textbox', { name: 'New state name', exact: true }).fill('showHelp');
    await page.getByRole('button', { name: 'Add state', exact: true }).click();
    await page
        .getByRole('combobox', { name: 'Prototype visibility', exact: true })
        .selectOption({ label: 'Follow showHelp' });
    await expect(page.getByRole('combobox', { name: 'Show when', exact: true })).toHaveValue(
        'true'
    );
    await select('Inspector comparison');
    await page
        .getByRole('combobox', { name: 'Prototype visibility', exact: true })
        .selectOption({ label: 'Follow showHelp' });
    await page.getByRole('combobox', { name: 'Show when', exact: true }).selectOption('false');
    await select('About these styles');
    await page
        .getByLabel(/^On (activation|Enter): action$/)
        .selectOption({ label: 'Set showHelp to true' });
    await select('Sentence · Regular');
    await page
        .getByLabel(/^On (activation|Enter): action$/)
        .selectOption({ label: 'Set showHelp to false' });
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await select('Inspector comparison');
    await expect(page.getByRole('combobox', { name: 'Show when', exact: true })).toHaveValue(
        'false'
    );
    await page.getByRole('combobox', { name: 'Show when', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/boolean-condition-inspector.png' });
    await select('Sentence · Regular');
    await expect(
        page.getByLabel(/^On (activation|Enter): action$/).locator('option:checked')
    ).toHaveText('Set showHelp to false');
    await page.getByRole('link', { name: 'Open prototype' }).click();
    const player = page.frameLocator('iframe[title="Application preview"]');
    const open = player.getByRole('button', { name: 'About these styles', exact: true });
    const close = player.getByRole('button', { name: 'Sentence · Regular', exact: true });
    const comparison = player.getByText('Properties', { exact: true });
    const help = player.getByText('Sentence case is easier to scan.', { exact: true });
    await expect(comparison).toBeVisible();
    await expect(help).toHaveCount(0);
    await open.click();
    await open.press('Enter');
    await expect(help).toBeVisible();
    await expect(comparison).toHaveCount(0);
    await expect(open).not.toHaveAttribute('aria-pressed');
    await close.click();
    await close.press('Space');
    await expect(comparison).toBeVisible();
    await expect(help).toHaveCount(0);
    await expect(close).not.toHaveAttribute('aria-pressed');
    await open.click();
    await page.getByRole('button', { name: 'Reset prototype', exact: true }).click();
    await expect(comparison).toBeVisible();
    await expect(help).toHaveCount(0);
});

test('a disclosure reports the visible state of an inverse-bound target', async ({
    page,
    context
}) => {
    const { createDocument } = await import('src/app/factories');
    const { buildInspectorTypography } = await import('src/templates/inspectorTypography');
    const { projectPreview } = await import('src/preview/project');
    const { PREVIEW_PROTOCOL_VERSION } = await import('src/preview/protocol');
    let id = 0;
    const document = createDocument(buildInspectorTypography(() => `s${++id}`));
    document.prototypeBooleans.flag = { id: 'flag', name: 'hideHelp', initial: false };
    const help = Object.values(document.shapes).find(
        (shape) => shape.type === 'instance' && shape.name === 'Inspector help'
    )!;
    if (help.type !== 'instance') {
        throw new Error('Expected help instance');
    }
    help.prototypeVisibilityStateId = 'flag';
    help.prototypeVisibilityWhen = false;
    const application = projectPreview(document, {});
    await context.route('**/api/prototype-links/open', (route) =>
        route.fulfill({ json: { version: PREVIEW_PROTOCOL_VERSION, application } })
    );
    await page.goto(`http://127.0.0.1:4194/share#${'a'.repeat(43)}`);
    const toggle = page.getByRole('button', { name: 'About these styles', exact: true });
    const text = page.getByText('Sentence case is easier to scan.', { exact: true });
    await expect(text).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(text).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.press('Enter');
    await expect(text).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});
