import { expect, test } from '@playwright/test';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { accessibilityFixture } from '../support/accessibility';

test('checks pages in each mode and size, accepts AI fixes and reports in the download', async ({
    page,
    browser
}, info) => {
    const document = accessibilityFixture(true);
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await page.goto('/prototype?ai=local');

    await page.getByRole('button', { name: 'Prototype settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Prototype settings' });
    await expect(settings.getByRole('group', { name: 'Theme' }).getByLabel('Dark')).toBeChecked();
    await settings.getByRole('group', { name: 'Sizes' }).getByLabel('Tablet').uncheck();
    await expect(settings).toContainText('4 combinations.');
    await settings.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Accessibility' }).click();
    const check = page.getByRole('dialog', { name: 'Accessibility' });
    await expect(check.getByRole('status')).toHaveText(
        '5 problems in 4 contexts; 3 can be fixed here.'
    );
    await expect(check).toContainText(
        'Checked: Light · Mobile, Light · Desktop, Dark · Mobile, Dark · Desktop'
    );
    await expect(check).toContainText(
        "The button “Help” is named “Rectangle 7”, which doesn't include the text it shows."
    );
    await expect(check).toContainText('In Dark · Mobile, Dark · Desktop');
    await check.screenshot({ path: info.outputPath('check.png') });

    await check.getByRole('button', { name: 'Propose fixes' }).click();
    const proposal = check.getByRole('group', { name: 'Proposed changes' });
    await expect(proposal.getByRole('listitem')).toHaveCount(2);
    await check.screenshot({ path: info.outputPath('proposal.png') });
    await proposal.getByRole('button', { name: 'Accept' }).click();
    await expect(check.getByRole('status')).toHaveText(
        '2 problems in 4 contexts; 0 can be fixed here.'
    );
    await check.getByRole('button', { name: 'Done' }).click();

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download prototype' }).click();
    const file = info.outputPath('package.html');
    await (await downloading).saveAs(file);

    const offline = await browser.newContext({ offline: true });
    const played = await offline.newPage();
    const errors: string[] = [];
    played.on('console', (message) => {
        if (message.type() === 'error') {
            errors.push(message.text());
        }
    });
    await played.goto(`file://${file}`);
    const modes = played.getByLabel('Modes and size');
    await expect(modes.getByRole('option')).toHaveText([
        'As tested',
        'Light · Mobile',
        'Light · Desktop',
        'Dark · Mobile',
        'Dark · Desktop'
    ]);
    await modes.selectOption({ label: 'Dark · Desktop' });
    await played.getByRole('button', { name: 'Accessibility' }).click();
    const report = played.getByRole('region', { name: 'Accessibility report' });
    await expect(
        report.getByRole('list', { name: 'Focus order' }).getByRole('listitem')
    ).toHaveText(['“Sign in”', '“Email”', '“Help”']);
    await expect(report.getByRole('list', { name: 'Names' })).toContainText('Button: “Help”');
    await expect(report.getByRole('list', { name: 'Contrast' })).toContainText(
        /“Welcome back”: [\d.]+:1, passes 4\.5:1/
    );
    await expect(report.getByRole('list', { name: 'Problems' }).getByRole('listitem')).toHaveText([
        'Tab goes from “Sign in” back to “Email”.'
    ]);
    await expect(played.locator('svg[aria-label="Sign in"]')).toHaveAttribute('width', '1280');
    await modes.selectOption({ label: 'Light · Mobile' });
    await expect(report.getByRole('list', { name: 'Problems' })).toContainText(
        '“We never share it” has contrast'
    );
    await expect(played.locator('svg[aria-label="Sign in"]')).toHaveAttribute('width', '390');
    await played.screenshot({ path: info.outputPath('package-report.png') });
    expect(errors).toEqual([]);
    await offline.close();
});
