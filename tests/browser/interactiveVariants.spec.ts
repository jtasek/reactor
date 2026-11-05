import { expect, test } from '@playwright/test';

test('typography switches locally, supports keyboard activation and resets without editing the document', async ({
    page
}) => {
    await page.goto('/documents');
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await page
        .getByRole('button', { name: 'Use Inspector typography template', exact: true })
        .click();
    await expect(page.locator('#screen-views > g')).toHaveCount(1);
    await page.getByRole('link', { name: 'Open prototype' }).click();
    const player = page.frameLocator('iframe[title="Application preview"]');
    await expect(
        player.getByRole('button', { name: 'Sentence · Medium', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    const upper = player.getByRole('button', { name: 'Uppercase · Semibold', exact: true });
    await upper.focus();
    await upper.press('Enter');
    await expect(player.getByText('PROPERTIES', { exact: true })).toHaveAttribute(
        'font-weight',
        '600'
    );
    await expect(upper).toBeFocused();
    await expect(upper).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: 'test-results/inspector-typography-prototype.png' });
    await player.getByRole('button', { name: 'Sentence · Regular', exact: true }).click();
    await expect(player.getByText('Properties', { exact: true })).toHaveAttribute(
        'font-weight',
        '400'
    );
    await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
    await expect(player.getByText('Properties', { exact: true })).toHaveAttribute(
        'font-weight',
        '500'
    );
    await upper.click();
    await page.reload();
    await expect(player.getByText('Properties', { exact: true })).toHaveAttribute(
        'font-weight',
        '500'
    );
});

test('shared typography snapshots switch variants independently and reset at narrow widths', async ({
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
    await context.route('**/api/prototype-links/open', (route) =>
        route.fulfill({ json: { version: PREVIEW_PROTOCOL_VERSION, application: drawing } })
    );
    const url = `http://127.0.0.1:4194/share#${'a'.repeat(43)}`;
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto(url);
    const other = await context.newPage();
    await other.goto(url);
    await page.getByRole('button', { name: 'Uppercase · Semibold', exact: true }).click();
    await expect(page.getByText('PROPERTIES', { exact: true })).toHaveAttribute(
        'font-weight',
        '600'
    );
    await expect(other.getByText('Properties', { exact: true })).toHaveAttribute(
        'font-weight',
        '500'
    );
    await page.screenshot({
        path: 'test-results/inspector-typography-shared-narrow.png',
        fullPage: true
    });
    await page.getByRole('button', { name: 'Reset prototype', exact: true }).click();
    await expect(page.getByText('Properties', { exact: true })).toHaveAttribute(
        'font-weight',
        '500'
    );
    await other.close();
});

test('authors a variant action in Inspector and preserves it after reload', async ({ page }) => {
    const { openEditor } = await import('./support/editor');
    await page.goto('/documents');
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await page
        .getByRole('button', { name: 'Use Inspector typography template', exact: true })
        .click();
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await openEditor(page, ['Inspector', 'Explorer']);
    const selectButton = () =>
        page
            .getByRole('region', { name: 'Explorer', exact: true })
            .getByRole('button', { name: 'Sentence · Regular', exact: true })
            .first() // Canvas instance precedes its component sources.
            .click();
    await selectButton();
    const action = page.getByLabel(/^On (activation|Enter): action$/, { exact: true });
    await action.selectOption({ label: 'Inspector comparison → Uppercase · Semibold' });
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.reload();
    await selectButton();
    await expect(action.locator('option:checked')).toHaveText(
        'Inspector comparison → Uppercase · Semibold'
    );
    await page.getByRole('link', { name: 'Open prototype' }).click();
    const player = page.frameLocator('iframe[title="Application preview"]');
    await player.getByRole('button', { name: 'Sentence · Regular', exact: true }).click();
    await expect(player.getByText('PROPERTIES', { exact: true })).toHaveAttribute(
        'font-weight',
        '600'
    );
});
