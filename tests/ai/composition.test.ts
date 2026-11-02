import { readOperations } from 'src/ai/operations';
import { documentContext } from 'src/ai/context';
import { authoringKeys } from 'src/app/screenAuthoring';
import { fixtureDocument } from './harness';
import {
    createCopies,
    DOCUMENT_ID,
    settle,
    sharedContent,
    shownDocument
} from '../support/collaboration';
import { measureContextualText } from 'src/app/textMeasurement';
import { TOOLS, toolsFor } from '../../server/aiTasks';

const seed = () =>
    fixtureDocument({
        variables: {
            ink: { name: 'Ink', type: 'color', value: '#20242c' },
            surface: { name: 'Surface', type: 'color', value: '#ffffff' }
        },
        shapes: {
            box: {
                type: 'rectangle',
                position: { x: 0, y: 0 },
                size: { width: 200, height: 48 },
                fill: '#275de5'
            },
            caption: { type: 'text', position: { x: 16, y: 30 }, value: 'Button', fontSize: 16 },
            field: {
                type: 'rectangle',
                position: { x: 0, y: 0 },
                size: { width: 200, height: 48 },
                fill: '#ffffff'
            },
            label: { type: 'text', position: { x: 16, y: 30 }, value: 'Field', visible: false },
            hint: { type: 'text', position: { x: 16, y: 30 }, value: 'Placeholder' }
        },
        components: {
            action: {
                name: 'Action',
                shapesIds: ['box', 'caption'],
                props: [{ id: 'action-copy', key: 'text', shapeId: 'caption', label: 'Caption' }],
                interaction: { role: 'button', props: { label: 'action-copy' } }
            },
            entry: {
                name: 'Entry',
                shapesIds: ['field', 'label', 'hint'],
                props: [
                    { id: 'field-name', key: 'text', shapeId: 'label', label: 'Label' },
                    { id: 'field-hint', key: 'text', shapeId: 'hint', label: 'Hint' }
                ],
                interaction: {
                    role: 'input',
                    props: { label: 'field-name', placeholder: 'field-hint' }
                }
            }
        }
    });

const composition = () => ({
    op: 'composeScreen',
    key: 'screen',
    name: 'Account',
    width: 320,
    height: 480,
    x: 100,
    y: 200,
    background: '#FFFFFF',
    texts: [{ text: 'Welcome', x: 24, y: 24, width: 272, fontSize: 28, color: '#20242c' }],
    controls: [
        { componentId: 'entry', x: 24, y: 124, label: 'Email', placeholder: 'you@example.com' },
        { componentId: 'action', x: 24, y: 220, label: 'Continue', placeholder: '' },
        { componentId: 'action', x: 24, y: 300, label: 'Cancel', placeholder: '' }
    ],
    rectangles: []
});

it('compiles every control with its actual public property IDs and keeps acceptance atomic and undoable', async () => {
    const copies = await createCopies(2, (store) => store.actions.addDocument(seed()));
    const [a, b] = copies;
    const document = shownDocument(a);
    const before = sharedContent(a);
    const operations = readOperations(
        composition(),
        authoringKeys(document),
        documentContext(document)
    );
    const shapes = operations.filter((op) => op.op === 'addShape').map((op) => op.shape);
    expect(shapes.filter((shape) => shape.type === 'instance')).toMatchObject([
        {
            componentId: 'entry',
            position: { x: 124, y: 324 },
            overrides: { 'field-name': 'Email', 'field-hint': 'you@example.com' }
        },
        { componentId: 'action', overrides: { 'action-copy': 'Continue' } },
        { componentId: 'action', overrides: { 'action-copy': 'Cancel' } }
    ]);
    expect(shapes[0]).toMatchObject({ bindings: { fill: 'surface' } });
    const title = shapes.find((shape) => shape.type === 'text')!;
    expect(title).toMatchObject({ bindings: { fontColor: 'ink' }, wrapWidth: 272 });
    if (title.type !== 'text') {
        throw new Error('Expected title');
    }
    expect(measureContextualText(title).bounds.topLeft).toEqual({ x: 124, y: 224 });
    expect(a.store.actions.checkOperations({ documentId: DOCUMENT_ID, operations })).toEqual({
        valid: true
    });
    expect(sharedContent(a)).toEqual(before);
    expect(
        a.store.actions.applyOperations({
            documentId: DOCUMENT_ID,
            operations,
            by: { kind: 'ai', model: 'test', requestId: 'composition' }
        }).applied
    ).toBe(true);
    settle(copies);
    expect(sharedContent(a)).toEqual(sharedContent(b));
    expect(shownDocument(a).components).toEqual(document.components);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(sharedContent(a)).toEqual(before);
    expect(sharedContent(b)).toEqual(before);
    copies.forEach(({ collaboration }) => collaboration.dispose());
});

it.each([
    { controls: [{ componentId: 'action', x: 24, y: 220, placeholder: '' }] },
    { controls: [{ componentId: 'action', x: 24, y: 220, label: 'Continue' }] },
    { controls: [{ componentId: 'missing', x: 24, y: 220, label: 'Continue', placeholder: '' }] },
    { controls: [{ componentId: 'action', x: 200, y: 220, label: 'Continue', placeholder: '' }] },
    { texts: [{ text: 'Title', x: 24, y: 479, width: 272, fontSize: 28, color: 'ink' }] },
    { background: 'missing-variable' },
    { texts: [], controls: [], rectangles: [] },
    { width: Infinity },
    {
        controls: [
            { componentId: 'action', x: 24, y: 24, label: 'Overlaps heading', placeholder: '' }
        ]
    },
    {
        controls: [
            { componentId: 'action', x: 24, y: 200, label: 'First', placeholder: '' },
            { componentId: 'entry', x: 24, y: 210, label: 'Second', placeholder: '' }
        ]
    }
])('rejects incomplete content and invalid placements before proposing: %j', (changes) => {
    const context = documentContext({ ...seed(), selectedShapesIds: [] });
    expect(() => readOperations({ ...composition(), ...changes }, [], context)).toThrow();
});

it('requires explicit choice for ambiguous palette matches and preserves novel literals and escaped labels', () => {
    const document = seed();
    document.variables.other = {
        id: 'other',
        name: 'Other',
        type: 'color',
        values: { default: '#20242c' }
    };
    const context = documentContext({ ...document, selectedShapesIds: [] });
    expect(() => readOperations(composition(), [], context)).toThrow(/Several variables/);
    const input = composition();
    input.texts[0].color = 'ink';
    input.texts[0].text = '${literal}';
    input.controls[1].label = '${literal}';
    input.background = '#f1a2b3';
    const operations = readOperations(input, [], context);
    expect(operations[1]).toMatchObject({ shape: { fill: '#f1a2b3' } });
    expect(operations).toContainEqual(
        expect.objectContaining({
            shape: expect.objectContaining({ value: '\\${literal}' })
        })
    );
    expect(operations).toContainEqual(
        expect.objectContaining({
            shape: expect.objectContaining({ overrides: { 'action-copy': '\\${literal}' } })
        })
    );
});

it('requires visible content fields in provider schemas', () => {
    expect(TOOLS.find((tool) => tool.name === 'composeScreen')).toMatchObject({
        parameters: {
            required: expect.arrayContaining(['content', 'padding', 'gap', 'background']),
            properties: {
                content: {
                    items: {
                        anyOf: expect.arrayContaining([
                            expect.objectContaining({
                                required: expect.arrayContaining(['label', 'placeholder', 'kind'])
                            }),
                            expect.objectContaining({
                                required: expect.arrayContaining(['text', 'color', 'fontSize'])
                            })
                        ])
                    }
                }
            }
        }
    });
});

const column = () => ({
    op: 'composeScreen',
    key: 'column',
    name: 'Account',
    width: 320,
    height: 480,
    background: 'surface',
    padding: 24,
    gap: 16,
    content: [
        {
            kind: 'text',
            text: 'A heading that wraps onto another line',
            fontSize: 28,
            color: 'ink'
        },
        { kind: 'text', text: 'Email address', fontSize: 16, color: 'ink' },
        {
            kind: 'input',
            componentId: 'entry',
            label: 'Email address',
            placeholder: 'you@example.com',
            gapBefore: 8
        },
        {
            kind: 'button',
            componentId: 'action',
            label: 'Continue',
            placeholder: '',
            gapBefore: 32
        }
    ],
    footer: { text: 'A demonstration', fontSize: 12, color: 'ink' }
});

it('lays out wrapped content, labeled controls and a bottom footer without guessing baselines', () => {
    const input = column();
    const context = documentContext({ ...seed(), selectedShapesIds: [] });
    const operations = readOperations(input, [], context);
    const shapes = operations.filter((op) => op.op === 'addShape').map((op) => op.shape);
    const texts = shapes.filter((shape) => shape.type === 'text');
    const controls = shapes.filter((shape) => shape.type === 'instance');
    const boxes = texts.map((text) => measureContextualText(text).bounds);
    expect(boxes[0].topLeft.x).toBe(24);
    expect(boxes[0].topLeft.y).toBeCloseTo(24);
    expect(boxes[1].topLeft.y).toBeCloseTo(boxes[0].bottomRight.y + 16);
    expect(controls[0].position.x).toBe(24);
    expect(controls[0].position.y).toBeCloseTo(boxes[1].bottomRight.y + 8);
    expect(controls[1].position.y).toBe(controls[0].position.y + 48 + 32);
    expect(boxes[2].bottomRight.y).toBeCloseTo(456);
    expect(shapes[0].bindings).toEqual({ fill: 'surface' });
    expect(controls[0].overrides).toEqual({
        'field-name': 'Email address',
        'field-hint': 'you@example.com'
    });
});

it.each([
    { height: 120 },
    { padding: 160 },
    { padding: 70 },
    { gap: -1 },
    { content: [] },
    { content: [{ kind: 'button', componentId: 'missing', label: 'Missing', placeholder: '' }] },
    { content: [{ kind: 'text', text: 'Incomplete' }] }
])('rejects a column that cannot preserve all its content: %j', (changes) => {
    const context = documentContext({ ...seed(), selectedShapesIds: [] });
    expect(() => readOperations({ ...column(), ...changes }, [], context)).toThrow();
});

it('chooses an unambiguous role and rejects a component with the wrong control role', () => {
    const context = documentContext({ ...seed(), selectedShapesIds: [] });
    const content = [{ kind: 'button', label: 'Continue', placeholder: '' }];
    const operations = readOperations({ ...column(), content }, [], context);
    expect(operations).toContainEqual(
        expect.objectContaining({
            shape: expect.objectContaining({
                componentId: 'action',
                overrides: { 'action-copy': 'Continue' }
            })
        })
    );
    expect(() =>
        readOperations(
            { ...column(), content: [{ ...content[0], componentId: 'entry' }] },
            [],
            context
        )
    ).toThrow(/not a button/);
    const ambiguous = {
        ...context,
        components: { ...context.components, another: context.components.action }
    };
    expect(() => readOperations({ ...column(), content }, [], ambiguous)).toThrow(/component ID/);
});

it('binds a palette color to the alias rather than the primitive it points at', () => {
    const document = seed();
    document.variables.brand = {
        id: 'brand',
        name: 'Brand ink',
        type: 'color',
        values: { default: '#000000' },
        alias: 'ink'
    };
    document.variables.text = {
        id: 'text',
        name: 'Text',
        type: 'color',
        values: { default: '#000000' },
        alias: 'brand'
    };
    const context = documentContext({ ...document, selectedShapesIds: [] });
    const operations = readOperations(composition(), [], context);
    const title = operations.find((op) => op.op === 'addShape' && op.shape.type === 'text');
    expect(title).toMatchObject({ shape: { bindings: { fontColor: 'text' } } });

    // Two aliases of one primitive are still a choice for the model.
    document.variables.heading = { ...document.variables.text, id: 'heading', name: 'Heading' };
    const twoAliases = documentContext({ ...document, selectedShapesIds: [] });
    expect(() => readOperations(composition(), [], twoAliases)).toThrow(/Several variables/);
});

it('says when the library has no component for a control role', () => {
    const context = documentContext({ ...seed(), selectedShapesIds: [] });
    const withoutInputs = {
        ...context,
        components: { action: context.components.action }
    };
    expect(() =>
        readOperations(
            { ...column(), content: [{ kind: 'input', label: 'Email', placeholder: '' }] },
            [],
            withoutInputs
        )
    ).toThrow('The library has no input component.');
});

it('renders a dedicated footer once and removes its duplicate from column spacing', () => {
    const context = documentContext({ ...seed(), selectedShapesIds: [] });
    const input = column();
    const expected = readOperations(input, [], context);
    const duplicated = {
        ...input,
        content: [
            { kind: 'text', ...input.footer, gapBefore: 400 },
            ...input.content,
            { kind: 'text', ...input.footer }
        ]
    };
    expect(readOperations(duplicated, [], context)).toEqual(expected);
});

it('offers separate control roles without irrelevant component IDs for unique choices', () => {
    const context = documentContext({ ...seed(), selectedShapesIds: [] });
    const tools = toolsFor({ task: 'edit', prompt: 'Screen', context });
    const tool = tools.find((tool) => tool.name === 'composeScreen')!;
    const schema = JSON.parse(JSON.stringify(tool.parameters));
    const [, button, input] = schema.properties.content.items.anyOf;
    expect(button.properties.kind.enum).toEqual(['button']);
    expect(input.properties.kind.enum).toEqual(['input']);
    expect(button.properties.componentId).toBeUndefined();
    expect(input.required).toContain('placeholder');
    expect(button.required).not.toContain('placeholder');
    const operations = readOperations(
        { ...column(), content: [{ kind: 'button', label: 'Continue' }] },
        [],
        context
    );
    expect(operations).toContainEqual(
        expect.objectContaining({ shape: expect.objectContaining({ componentId: 'action' }) })
    );
});

it('offers only control roles the library can supply, with an ID choice when several match', () => {
    const branches = (components: object) => {
        const tool = toolsFor({ task: 'edit', prompt: 'Screen', context: { components } }).find(
            (tool) => tool.name === 'composeScreen'
        )!;

        return JSON.parse(JSON.stringify(tool.parameters)).properties.content.items.anyOf;
    };
    const role = (name: string) => ({ interaction: { role: name, props: {} } });

    expect(
        branches({}).map(
            (branch: { properties: { kind: { enum: string[] } } }) => branch.properties.kind.enum
        )
    ).toEqual([['text']]);
    const [, button] = branches({ primary: role('button'), quiet: role('button') });
    expect(button.properties.kind.enum).toEqual(['button']);
    expect(button.properties.componentId.enum).toEqual(['primary', 'quiet']);
    expect(button.required).toContain('componentId');
});
