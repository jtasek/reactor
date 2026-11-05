import { expect, test } from '@playwright/test';

test('authors shared boolean state, binds two instances, renames it and reloads', async ({
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
    const visibility = page.getByRole('combobox', { name: 'Prototype visibility', exact: true });
    const openStates = () =>
        page
            .locator('summary', { hasText: 'Prototype states' })
            .evaluate((summary) => ((summary.parentElement as HTMLDetailsElement).open = true));
    await select('Inspector help');
    await openStates();
    await page.getByRole('textbox', { name: 'New state name', exact: true }).fill('showHelp');
    await page.getByRole('button', { name: 'Add state', exact: true }).click();
    await visibility.selectOption({ label: 'Follow showHelp' });
    await select('Inspector comparison');
    await visibility.selectOption({ label: 'Follow showHelp' });
    await openStates();
    await page.getByRole('textbox', { name: 'Name of showHelp', exact: true }).fill('showDetails');
    await page.getByRole('textbox', { name: 'Name of showHelp', exact: true }).press('Tab');
    await expect(visibility.locator('option:checked')).toHaveText('Follow showDetails');
    await select('About these styles');
    await page
        .getByLabel(/^On (activation|Enter): action$/)
        .selectOption({ label: 'Toggle state: showDetails' });
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.screenshot({ path: 'test-results/named-state-inspector.png' });
    await page.reload();
    await select('About these styles');
    await expect(
        page.getByLabel(/^On (activation|Enter): action$/).locator('option:checked')
    ).toHaveText('Toggle state: showDetails');
    await page.getByRole('link', { name: 'Open prototype' }).click();
    const player = page.frameLocator('iframe[title="Application preview"]');
    const toggle = player.getByRole('button', { name: 'About these styles', exact: true });
    await expect(player.getByText('Properties', { exact: true })).toHaveCount(0);
    await expect(player.getByText('Sentence case is easier to scan.', { exact: true })).toHaveCount(
        0
    );
    await toggle.focus();
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(player.getByText('Properties', { exact: true })).toBeVisible();
    await expect(
        player.getByText('Sentence case is easier to scan.', { exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(player.getByText('Properties', { exact: true })).toHaveCount(0);
});

test('shared sessions isolate named state and preserve hidden input values until Reset', async ({
    page,
    context
}) => {
    const { createDocument } = await import('src/app/factories');
    const { buildInspectorTypography } = await import('src/templates/inspectorTypography');
    const { projectPreview } = await import('src/preview/project');
    const { PREVIEW_PROTOCOL_VERSION } = await import('src/preview/protocol');
    let id = 0;
    const document = createDocument(buildInspectorTypography(() => `s${++id}`));
    document.prototypeBooleans.flag = { id: 'flag', name: 'showHelp', initial: false };
    const instances = Object.values(document.shapes).filter((shape) => shape.type === 'instance');
    instances.find((shape) => shape.name === 'Inspector help')!.prototypeVisibilityStateId = 'flag';
    instances.find((shape) => shape.name === 'About these styles')!.interactions = {
        activate: { type: 'toggleState', stateId: 'flag' }
    };
    const drawing = projectPreview(document, {});
    const help = drawing.screens[0].nodes.find(
        (node) => node.visibility?.stateKey === 'state:flag'
    )!;
    help.control = { role: 'input', label: 'Notes', value: '', x: 0, y: 0, width: 300, height: 32 };
    const second = structuredClone(help);
    second.key = 'second-help';
    second.visibility!.key = 'second-help';
    drawing.screens.push({
        id: 'second',
        name: 'Second screen',
        x: 0,
        y: 0,
        width: 420,
        height: 860,
        nodes: [second]
    });
    await context.route('**/api/prototype-links/open', (route) =>
        route.fulfill({ json: { version: PREVIEW_PROTOCOL_VERSION, application: drawing } })
    );
    const url = `http://127.0.0.1:4194/share#${'a'.repeat(43)}`;
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto(url);
    const other = await context.newPage();
    await other.goto(url);
    const toggle = page.getByRole('button', { name: 'About these styles', exact: true });
    const notes = page.getByRole('textbox', { name: 'Notes', exact: true });
    await toggle.click();
    await notes.fill('Retain my note');
    await toggle.click();
    await expect(notes).toHaveCount(0);
    await toggle.press('Space');
    await expect(notes).toHaveValue('Retain my note');
    await page
        .getByRole('combobox', { name: 'Preview screen', exact: true })
        .selectOption('second');
    await expect(notes).toBeVisible();
    await page
        .getByRole('combobox', { name: 'Preview screen', exact: true })
        .selectOption(drawing.screens[0].id);
    await expect(notes).toHaveValue('Retain my note');
    await expect(other.getByRole('textbox', { name: 'Notes', exact: true })).toHaveCount(0);
    await page.screenshot({ path: 'test-results/named-state-narrow.png', fullPage: true });
    await page.getByRole('button', { name: 'Reset prototype', exact: true }).click();
    await toggle.click();
    await expect(notes).toHaveValue('');
    await other.close();
});
