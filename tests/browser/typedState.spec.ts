import { expect, test } from '@playwright/test';

test('a shared prototype sets, shows, types into and resets text state', async ({
    page,
    context
}) => {
    const { previewFixture } = await import('../support/preview');
    const { createComponent, createShape } = await import('src/app/factories');
    const { projectPreview } = await import('src/preview/project');
    const { PREVIEW_PROTOCOL_VERSION, readPreview } = await import('src/shared/previewProtocol');
    const document = previewFixture();
    document.prototypeBooleans = {
        tab: { id: 'tab', name: 'Tab', type: 'text', initial: 'Profile' },
        name: { id: 'name', name: 'Name', type: 'text', initial: 'Ada' }
    };
    // The field's Value is the Name state, shown only on the Billing tab.
    document.shapes.typed = {
        ...createShape({
            type: 'text',
            name: 'Typed',
            order: 'a7',
            value: '',
            position: { x: 0, y: 48 }
        }),
        id: 'typed',
        selected: false
    };
    document.components.input.shapesIds.push('typed');
    document.components.input.props!.push({
        id: 'value',
        shapeId: 'typed',
        key: 'text',
        label: 'Value'
    });
    document.components.input.interaction!.props.value = 'value';
    const field = document.shapes.name;
    const next = document.shapes.next;
    if (field.type !== 'instance' || next.type !== 'instance') {
        throw new Error('Expected instances');
    }
    field.stateBindings = { value: 'name' };
    field.prototypeVisibleWhen = {
        kind: 'equals',
        left: { kind: 'state', stateId: 'tab' },
        right: { kind: 'value', value: 'Billing' }
    };
    next.interactions = {
        activate: { type: 'state', change: 'set', stateId: 'tab', value: 'Billing' }
    };
    // A greeting that shows the Name state as plain artwork.
    document.shapes.hello = {
        ...createShape({
            type: 'text',
            name: 'Hello',
            order: 'a5',
            value: 'Hello',
            position: { x: 0, y: 24 }
        }),
        id: 'hello',
        selected: false
    };
    document.components.greeting = createComponent({
        id: 'greeting',
        name: 'Greeting',
        sourceOnly: true,
        shapesIds: ['hello'],
        props: [{ id: 'text', shapeId: 'hello', key: 'text', label: 'Text' }]
    });
    document.shapes.greet = {
        ...createShape({
            type: 'instance',
            name: 'Greeting',
            order: 'a6',
            componentId: 'greeting',
            position: { x: 24, y: 200 },
            parentFrameId: 'home',
            overrides: {}
        }),
        id: 'greet',
        selected: false,
        stateBindings: { text: 'name' }
    } as typeof field;
    document.shapesIds.push('hello', 'greet', 'typed');
    const application = readPreview(projectPreview(document, {}));
    await context.route('**/api/prototype-links/open', (route) =>
        route.fulfill({ json: { version: PREVIEW_PROTOCOL_VERSION, application } })
    );
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:4194/share#${'a'.repeat(43)}`);
    const greeting = page
        .locator('svg text', { hasText: /^(Ada|Grace|Grac)$/ })
        .filter({ visible: true });
    const textbox = page.getByRole('textbox', { name: 'Your name', exact: true });
    await expect(greeting).toHaveText('Ada');
    await expect(textbox).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(textbox).toHaveValue('Ada');
    await textbox.fill('Grace');
    await expect(greeting).toHaveText('Grace');
    // Typing keeps focus in the field while the drawing follows it.
    await textbox.press('Backspace');
    await expect(textbox).toBeFocused();
    await expect(greeting).toHaveText('Grac');
    await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
    await expect(greeting).toHaveText('Ada');
    await expect(textbox).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('authors a text state, a Set action and a condition in Inspector', async ({ page }) => {
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
    const openStates = () =>
        page
            .locator('summary', { hasText: 'Prototype states' })
            .evaluate((summary) => ((summary.parentElement as HTMLDetailsElement).open = true));
    await select('Inspector help');
    await openStates();
    await page.getByRole('textbox', { name: 'New state name', exact: true }).fill('Panel');
    await page
        .getByRole('combobox', { name: 'New state type', exact: true })
        .selectOption({ label: 'Text' });
    await page.getByRole('button', { name: 'Add state', exact: true }).click();
    const initial = page.getByRole('textbox', { name: 'Initial value of Panel', exact: true });
    await initial.fill('Styles');
    await initial.press('Enter');
    await page
        .getByRole('combobox', { name: 'Prototype visibility', exact: true })
        .selectOption({ label: 'Follow Panel' });
    const when = page.getByRole('textbox', {
        name: 'Show when the state has the value',
        exact: true
    });
    await expect(when).toHaveValue('Styles');
    await when.fill('Help');
    await when.press('Enter');
    await select('About these styles');
    await page
        .getByLabel(/^On (activation|Enter): action$/)
        .selectOption({ label: 'Set Panel to…' });
    const value = page.getByRole('textbox', { name: 'Value to set Panel to', exact: true });
    await expect(value).toHaveValue('Styles');
    await value.fill('Help');
    await value.press('Enter');
    await expect(page.locator('#status-save')).toHaveText('Saved');
    await page.screenshot({ path: 'test-results/typed-state-inspector.png' });
    await page.reload();
    await select('About these styles');
    await expect(
        page.getByRole('textbox', { name: 'Value to set Panel to', exact: true })
    ).toHaveValue('Help');
    await page.getByRole('link', { name: 'Open prototype' }).click();
    const player = page.frameLocator('iframe[title="Application preview"]');
    const help = player.getByText('Sentence case is easier to scan.', { exact: true });
    await expect(help).toHaveCount(0);
    await player.getByRole('button', { name: 'About these styles', exact: true }).click();
    await expect(help).toBeVisible();
    await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
    await expect(help).toHaveCount(0);
});

test('a number field keeps what is typed while it reads as the same number', async ({
    page,
    context
}) => {
    const { previewFixture } = await import('../support/preview');
    const { createShape } = await import('src/app/factories');
    const { projectPreview } = await import('src/preview/project');
    const { PREVIEW_PROTOCOL_VERSION, readPreview } = await import('src/shared/previewProtocol');
    const document = previewFixture();
    document.prototypeBooleans = {
        count: { id: 'count', name: 'Count', type: 'number', initial: 2 }
    };
    document.shapes.typed = {
        ...createShape({
            type: 'text',
            name: 'Typed',
            order: 'a7',
            value: '',
            position: { x: 0, y: 48 }
        }),
        id: 'typed',
        selected: false
    };
    document.shapesIds.push('typed');
    document.components.input.shapesIds.push('typed');
    document.components.input.props!.push({
        id: 'value',
        shapeId: 'typed',
        key: 'text',
        label: 'Value'
    });
    document.components.input.interaction!.props.value = 'value';
    const field = document.shapes.name;
    const next = document.shapes.next;
    if (field.type !== 'instance' || next.type !== 'instance') {
        throw new Error('Expected instances');
    }
    field.stateBindings = { value: 'count' };
    next.interactions = { activate: { type: 'state', change: 'set', stateId: 'count', value: 7 } };
    const application = readPreview(projectPreview(document, {}));
    await context.route('**/api/prototype-links/open', (route) =>
        route.fulfill({ json: { version: PREVIEW_PROTOCOL_VERSION, application } })
    );
    await page.goto(`http://127.0.0.1:4194/share#${'a'.repeat(43)}`);
    const textbox = page.getByRole('textbox', { name: 'Your name', exact: true });
    await expect(textbox).toHaveValue('2');
    await textbox.fill('');
    await textbox.pressSequentially('1.50');
    await expect(textbox).toHaveValue('1.50');
    await expect(textbox).toBeFocused();
    // A Set shows the new value in place of the typing.
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(textbox).toHaveValue('7');
});
