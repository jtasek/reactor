import { expect, test } from '@playwright/test';
import { recordDetailFixture } from '../support/dataList';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { projectPreview } from 'src/preview/project';
import { PREVIEW_PROTOCOL_VERSION } from 'src/preview/protocol';
import { openEditor } from './support/editor';

test('configures selected-record binding and navigates by keyboard with isolated values and Reset', async ({
    page
}, info) => {
    const { document, detail } = recordDetailFixture();
    delete detail.dataList!.mode;
    document.dataFields.nickname = {
        ...document.dataFields.name,
        id: 'nickname',
        name: 'Nickname'
    };
    document.dataRecords.ada.values.nickname = 'Countess';
    document.dataRecords.grace.values.nickname = 'Admiral';
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    await page.addInitScript(
        (value) => localStorage.setItem('reactor', value),
        JSON.stringify(saved)
    );
    await openEditor(page, ['Inspector', 'Explorer']);
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Customer details', exact: true })
        .click();
    const binding = page.getByRole('region', { name: 'Data binding', exact: true });
    await binding.getByLabel('Show', { exact: true }).selectOption('record');
    await expect(binding.getByLabel('Item gap')).toHaveCount(0);
    await expect(binding.getByLabel('Data field for Label')).toHaveValue('name');
    await binding.getByLabel('Show', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('record-inspector.png') });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.frameLocator('iframe[title="Application preview"]');
    await preview.getByLabel('Preview screen').selectOption('details');
    await expect(preview.getByRole('textbox', { name: 'Your name', exact: true })).toHaveValue(
        'Your name'
    );
    await preview.getByLabel('Preview screen').selectOption('home');
    const ada = preview.getByRole('button', { name: 'Ada', exact: true });
    await ada.focus();
    await ada.press('Enter');
    await expect(preview.getByLabel('Preview screen')).toHaveValue('details');
    await expect(preview.getByRole('textbox', { name: 'Ada', exact: true })).toHaveValue('Ada');
    await preview.getByRole('textbox', { name: 'Ada', exact: true }).fill('Edited Ada');
    await preview.getByLabel('Preview screen').selectOption('home');
    await preview.getByRole('button', { name: 'Grace', exact: true }).click();
    await expect(preview.getByRole('textbox', { name: 'Grace', exact: true })).toHaveValue('Grace');
    await preview.getByLabel('Preview screen').selectOption('home');
    await ada.click();
    await expect(preview.getByRole('textbox', { name: 'Ada', exact: true })).toHaveValue(
        'Edited Ada'
    );
    await page.screenshot({ path: info.outputPath('record-detail.png') });
    await binding.getByLabel('Data field for Label').selectOption('nickname');
    await expect(preview.getByRole('textbox', { name: 'Countess', exact: true })).toHaveValue(
        'Countess'
    );
    await preview.getByRole('button', { name: 'Restart preview' }).click();
    await preview.getByLabel('Preview screen').selectOption('details');
    await expect(preview.getByRole('textbox', { name: 'Your name', exact: true })).toHaveValue(
        'Your name'
    );
    await page.reload();
    await openEditor(page, ['Inspector', 'Explorer']);
    await page
        .getByRole('region', { name: 'Explorer' })
        .getByRole('button', { name: 'Customer details', exact: true })
        .click();
    await expect(binding.getByLabel('Show', { exact: true })).toHaveValue('record');
});

test('shared prototype sessions keep record selection and inputs private to each player', async ({
    page,
    context
}) => {
    const { document, instance } = recordDetailFixture();
    document.dataEntities.partners = { id: 'partners', name: 'Partners' };
    document.dataFields.partnerName = {
        id: 'partnerName',
        name: 'Name',
        entityId: 'partners',
        type: 'text',
        required: true
    };
    document.dataRecords.partner = {
        id: 'partner',
        entityId: 'partners',
        order: 0,
        values: { partnerName: 'Partner' }
    };
    document.shapes.partnerList = {
        ...instance,
        id: 'partnerList',
        order: 'a6',
        position: { x: 24, y: 160 },
        dataList: { entityId: 'partners', fields: { label: 'partnerName' }, gap: 8 }
    };
    document.shapesIds.push('partnerList');
    const drawing = projectPreview(document, {});
    await context.route('**/api/prototype-links/open', (route) =>
        route.fulfill({ json: { version: PREVIEW_PROTOCOL_VERSION, application: drawing } })
    );
    const url = `http://127.0.0.1:4194/share#${'a'.repeat(43)}`;
    await page.goto(url);
    await page.getByRole('button', { name: 'Ada', exact: true }).click();
    await page.getByRole('textbox', { name: 'Ada', exact: true }).fill('Private');
    const other = await context.newPage();
    await other.goto(url);
    await other.getByLabel('Preview screen').selectOption('details');
    await expect(other.getByRole('textbox', { name: 'Your name', exact: true })).toHaveValue(
        'Your name'
    );
    await other.getByLabel('Preview screen').selectOption('home');
    await other.getByRole('button', { name: 'Grace', exact: true }).click();
    await expect(other.getByRole('textbox', { name: 'Grace', exact: true })).toHaveValue('Grace');
    await expect(page.getByRole('textbox', { name: 'Ada', exact: true })).toHaveValue('Private');
    await page.getByLabel('Preview screen').selectOption('home');
    await page.getByRole('button', { name: 'Partner', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Your name', exact: true })).toHaveValue(
        'Your name'
    );
    await page.getByRole('button', { name: 'Restart prototype' }).click();
    await page.getByLabel('Preview screen').selectOption('details');
    await expect(page.getByRole('textbox', { name: 'Your name', exact: true })).toHaveValue(
        'Your name'
    );
    await other.close();
});

test('a plain navigation keeps the record only when leaving a screen that shows it', async ({
    page,
    context
}) => {
    const { document } = recordDetailFixture();
    const next = document.shapes.next;
    if (next.type !== 'instance') {
        throw new Error('Invalid fixture');
    }
    document.shapes.stay = {
        ...structuredClone(next),
        id: 'stay',
        order: 'a7',
        parentFrameId: 'details',
        position: { x: 424, y: 300 }
    };
    document.shapesIds.push('stay');
    const drawing = projectPreview(document, {});
    await context.route('**/api/prototype-links/open', (route) =>
        route.fulfill({ json: { version: PREVIEW_PROTOCOL_VERSION, application: drawing } })
    );
    await page.goto(`http://127.0.0.1:4194/share#${'a'.repeat(43)}`);
    await page.getByRole('button', { name: 'Ada', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Ada', exact: true })).toHaveValue('Ada');
    // Details shows Ada, so its own Continue button keeps her.
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Ada', exact: true })).toHaveValue('Ada');
    await page.getByLabel('Preview screen').selectOption('home');
    // Home shows no selected record, so its Continue button opens the component values.
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByLabel('Preview screen')).toHaveValue('details');
    await expect(page.getByRole('textbox', { name: 'Your name', exact: true })).toHaveValue(
        'Your name'
    );
});
