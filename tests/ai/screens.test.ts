import { prototypeDocument } from '../support/prototype';
import { readOperation, readOperations } from 'src/ai/operations';
import { describeOperation } from 'src/ai/describe';
import { documentContext } from 'src/ai/context';
import {
    createCopies,
    DOCUMENT_ID,
    shownDocument,
    sharedContent,
    settle
} from '../support/collaboration';
import { screenLayoutsDocument } from '../support/screenLayouts';
import { operations } from './cases/create-responsive-screen/case';
import { TOOLS } from '../../server/aiTasks';
import { authoringKeys } from 'src/app/screenAuthoring';

it('validates without writing, then accepts screens and views as one collaborative undo step', async () => {
    const copies = await createCopies(2);
    const [a, b] = copies;
    const batch = {
        documentId: DOCUMENT_ID,
        operations: operations.map(readOperation),
        by: { kind: 'ai' as const, model: 'test', requestId: 'screens' }
    };
    const before = sharedContent(a);
    expect(a.store.actions.checkOperations(batch)).toEqual({ valid: true });
    expect(sharedContent(a)).toEqual(before);
    expect(a.store.actions.applyOperations(batch).applied).toBe(true);
    settle(copies);
    expect(sharedContent(a)).toEqual(sharedContent(b));
    expect(
        Object.values(shownDocument(a).frames).filter((frame) => frame.kind === 'view')
    ).toHaveLength(2);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(Object.keys(shownDocument(a).frames)).toHaveLength(0);
    expect(Object.keys(shownDocument(b).frames)).toHaveLength(0);
    a.collaboration.redo(DOCUMENT_ID);
    settle(copies);
    expect(Object.keys(shownDocument(a).frames)).toHaveLength(4);
});

it.each(['missing', 'desktop'])('rejects a %s responsive target atomically', async (target) => {
    const [copy] = await createCopies(1, (store) =>
        store.actions.addDocument(screenLayoutsDocument(DOCUMENT_ID))
    );
    const before = sharedContent(copy);
    const result = copy.store.actions.applyOperations({
        documentId: DOCUMENT_ID,
        by: { kind: 'person' },
        operations: [
            readOperation({
                op: 'updateFrame',
                frame: 'home',
                changes: { responsiveLayouts: { rule: { minWidth: 600, layoutId: target } } }
            })
        ]
    });
    expect(result.applied).toBe(false);
    expect(sharedContent(copy)).toEqual(before);
});

it('resolves added layouts in existing-screen rule updates and preserves explicit views', async () => {
    const [copy] = await createCopies(1, (store) =>
        store.actions.addDocument(screenLayoutsDocument(DOCUMENT_ID))
    );
    const result = copy.store.actions.applyOperations({
        documentId: DOCUMENT_ID,
        by: { kind: 'person' },
        operations: [
            readOperation({
                op: 'addFrame',
                key: 'new-layout',
                frame: {
                    kind: 'frame',
                    screenLayout: true,
                    parentFrameId: 'home',
                    name: 'New layout',
                    position: { x: 0, y: 0 },
                    size: { width: 900, height: 500 }
                }
            }),
            readOperation({
                op: 'updateFrame',
                frame: 'home',
                changes: { responsiveLayouts: { large: { minWidth: 800, layoutId: 'new-layout' } } }
            })
        ]
    });
    expect(result.applied).toBe(true);
    if (!result.applied) {
        return;
    }
    expect(shownDocument(copy).frames.home.responsiveLayouts?.large.layoutId).toBe(
        result.ids['new-layout']
    );
    expect(shownDocument(copy).frames.mobile.layoutId).toBe('compact');
});

it('provides selected-view source artwork and rule dependencies without unrelated content', async () => {
    const [copy] = await createCopies(1, (store) =>
        store.actions.addDocument(screenLayoutsDocument(DOCUMENT_ID))
    );
    const document = shownDocument(copy);
    copy.store.actions.editFrame({ kind: 'select', id: 'mobile' });
    const context = documentContext(document);
    expect(context.selectedFrameId).toBe('mobile');
    // The screen's other view comes along, so a new view can be placed beside it.
    expect(Object.keys(context.frames).sort()).toEqual(['compact', 'desktop', 'home', 'mobile']);
    expect(Object.keys(context.shapes).sort()).toEqual(['body', 'compact-body']);
    expect(context.frames.mobile.screenId).toBe('home');
});

it('keeps the design system available with a frame selected, but not with shapes selected', () => {
    const document = {
        ...screenLayoutsDocument(),
        variables: {
            primary: {
                id: 'primary',
                name: 'Primary',
                type: 'color',
                values: { default: '#3366ff' }
            }
        }
    } as ReturnType<typeof screenLayoutsDocument>;

    expect(
        documentContext({ ...document, selectedShapesIds: [], selectedFrameId: 'desktop' })
            .variables
    ).toHaveProperty('primary');
    expect(
        documentContext({ ...document, selectedShapesIds: ['body'], selectedFrameId: undefined })
            .variables
    ).toEqual({});
});

it('names records added earlier in the same proposal instead of showing their keys', () => {
    const document = screenLayoutsDocument();
    const batch = [
        {
            op: 'addFrame',
            key: 'shop',
            frame: {
                kind: 'screen',
                name: 'Shop',
                position: { x: 0, y: 900 },
                size: { width: 300, height: 300 },
                responsiveLayouts: { wide: { minWidth: 600, layoutId: 'shop-wide' } }
            }
        },
        {
            op: 'addFrame',
            key: 'shop-wide',
            frame: {
                kind: 'frame',
                screenLayout: true,
                parentFrameId: 'shop',
                name: 'Wide',
                position: { x: 0, y: 1300 },
                size: { width: 700, height: 300 }
            }
        },
        {
            op: 'addFrame',
            key: 'tablet',
            frame: {
                kind: 'view',
                screenId: 'shop',
                name: 'Tablet',
                position: { x: 400, y: 900 },
                size: { width: 700, height: 300 }
            }
        },
        {
            op: 'addShape',
            key: 'title',
            shape: {
                type: 'text',
                value: 'Hi',
                parentFrameId: 'shop',
                position: { x: 24, y: 924 }
            }
        }
    ].map(readOperation);
    const lines = batch.map((operation) => describeOperation(operation, document, batch));

    expect(lines[0]).toContain('600px → “Wide”');
    expect(lines[1]).toContain('Add screen layout “Wide” (700 × 300) for “Shop”');
    expect(lines[2]).toContain('Add Screen view “Tablet” (700 × 300) for “Shop”');
    expect(lines[3]).toBe('Add text in “Shop”: “Hi”');
    expect(describeOperation(batch[3], document)).toBe('Add text in “shop”: “Hi”');
});

it('describes frame identity and responsive changes and exposes both tools to providers', () => {
    const document = screenLayoutsDocument();
    expect(describeOperation(readOperation(operations[0]), document)).toContain(
        'Add screen “Home”'
    );
    expect(describeOperation(readOperation(operations[4]), document)).toContain(
        'Add Screen view “Mobile”'
    );
    expect(
        describeOperation(
            readOperation({
                op: 'updateFrame',
                frame: 'home',
                changes: { responsiveLayouts: { rule: { minWidth: 600, layoutId: 'compact' } } }
            }),
            document
        )
    ).toContain('600px → “Compact”');
    expect(TOOLS.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(['addFrame', 'updateFrame'])
    );
});

it.each([
    {
        kind: 'duplicate thresholds',
        changes: {
            responsiveLayouts: {
                a: { minWidth: 600, layoutId: 'home' },
                b: { minWidth: 600, layoutId: 'compact' }
            }
        }
    }
])('rejects $kind without changing the document', async ({ changes }) => {
    const [copy] = await createCopies(1, (store) =>
        store.actions.addDocument(screenLayoutsDocument(DOCUMENT_ID))
    );
    const before = sharedContent(copy);
    const result = copy.store.actions.applyOperations({
        documentId: DOCUMENT_ID,
        by: { kind: 'person' },
        operations: [readOperation({ op: 'updateFrame', frame: 'home', changes })]
    });
    expect(result.applied).toBe(false);
    expect(sharedContent(copy)).toEqual(before);
    copy.collaboration.dispose();
});

it('rejects a new view with an unavailable or foreign explicit layout and a locked screen update', async () => {
    const [copy] = await createCopies(1, (store) => {
        const document = screenLayoutsDocument(DOCUMENT_ID);
        document.frames.home.locked = true;
        store.actions.addDocument(document);
    });
    const check = (operation: unknown) =>
        copy.store.actions.checkOperations({
            documentId: DOCUMENT_ID,
            operations: [readOperation(operation)]
        });
    expect(check({ op: 'updateFrame', frame: 'home', changes: { name: 'Changed' } }).valid).toBe(
        false
    );
    expect(
        check({
            op: 'addFrame',
            key: 'bad-view',
            frame: {
                kind: 'view',
                name: 'Bad',
                screenId: 'home',
                layoutId: 'desktop',
                position: { x: 0, y: 0 },
                size: { width: 320, height: 480 }
            }
        }).valid
    ).toBe(false);
    copy.collaboration.dispose();
});

it('creates one implicit view when no explicit view is proposed', async () => {
    const [copy] = await createCopies(1);
    expect(
        copy.store.actions.applyOperations({
            documentId: DOCUMENT_ID,
            by: { kind: 'person' },
            operations: [
                readOperation({
                    op: 'addFrame',
                    key: 'screen',
                    frame: {
                        kind: 'screen',
                        name: 'Screen',
                        position: { x: 0, y: 0 },
                        size: { width: 320, height: 480 }
                    }
                })
            ]
        }).applied
    ).toBe(true);
    expect(
        Object.values(shownDocument(copy).frames).filter((frame) => frame.kind === 'view')
    ).toHaveLength(1);
    copy.collaboration.dispose();
});

it('includes independent mode definitions for a selected view and counts frame metadata toward the limit', () => {
    const document = prototypeDocument();
    const context = documentContext({
        ...document,
        selectedShapesIds: [],
        selectedFrameId: 'view',
        shapesIds: Object.keys(document.shapes)
    });
    expect(context.frames.view.modeOverrides).toEqual({ theme: 'dark' });
    expect(context.dimensions.theme).toEqual(document.dimensions.theme);
    const frames = Object.fromEntries(
        Array.from({ length: 301 }, (_, index) => [
            `frame-${index}`,
            { ...document.frames.view, id: `frame-${index}` }
        ])
    );
    expect(() =>
        documentContext({
            ...document,
            frames,
            selectedFrameId: undefined,
            selectedShapesIds: [],
            shapesIds: []
        })
    ).toThrow(/too large/i);
});

it('rejects malformed frame geometry and a view without its screen reference while parsing', () => {
    const frame = {
        kind: 'screen',
        name: 'Home',
        position: { x: 0, y: 0 },
        size: { width: -1, height: 480 }
    };
    expect(() => readOperation({ op: 'addFrame', key: 'home', frame })).toThrow();
    expect(() =>
        readOperation({
            op: 'addFrame',
            key: 'view',
            frame: { ...frame, kind: 'view', size: { width: 320, height: 480 } }
        })
    ).toThrow();
});

it('retains an existing missing layout reference while adding a valid rule', async () => {
    const [copy] = await createCopies(1, (store) => {
        const document = screenLayoutsDocument(DOCUMENT_ID);
        document.frames.home.responsiveLayouts = {
            old: { minWidth: 200, layoutId: 'removed-layout' }
        };
        store.actions.addDocument(document);
    });
    const rules = {
        old: { minWidth: 200, layoutId: 'removed-layout' },
        wide: { minWidth: 800, layoutId: 'compact' }
    };
    expect(
        copy.store.actions.applyOperations({
            documentId: DOCUMENT_ID,
            by: { kind: 'person' },
            operations: [
                readOperation({
                    op: 'updateFrame',
                    frame: 'home',
                    changes: { responsiveLayouts: rules }
                })
            ]
        }).applied
    ).toBe(true);
    expect(shownDocument(copy).frames.home.responsiveLayouts).toEqual(rules);
    copy.collaboration.dispose();
});

it('rejects duplicate alternate-layout names within a screen, including two new layouts', async () => {
    const [copy] = await createCopies(1, (store) =>
        store.actions.addDocument(screenLayoutsDocument(DOCUMENT_ID))
    );
    const layout = (key: string, name: string) =>
        readOperation({
            op: 'addFrame',
            key,
            frame: {
                kind: 'frame',
                screenLayout: true,
                parentFrameId: 'home',
                name,
                position: { x: 0, y: 0 },
                size: { width: 800, height: 480 }
            }
        });
    const check = (operations: ReturnType<typeof readOperation>[]) =>
        copy.store.actions.checkOperations({ documentId: DOCUMENT_ID, operations });
    const before = sharedContent(copy);
    expect(check([layout('duplicate', 'Compact')]).valid).toBe(false);
    expect(check([layout('one', 'Wide'), layout('two', 'Wide')]).valid).toBe(false);
    expect(check([layout('unique', 'Wide')]).valid).toBe(true);
    expect(sharedContent(copy)).toEqual(before);
    copy.collaboration.dispose();
});

it('exposes shape ownership and bindings directly to compatible tool templates', () => {
    expect(TOOLS.find((tool) => tool.name === 'addShape')).toMatchObject({
        parameters: {
            properties: {
                shape: {
                    type: 'object',
                    properties: {
                        parentFrameId: { type: 'string' },
                        bindings: { type: 'object' },
                        componentId: { type: 'string' },
                        type: { enum: expect.arrayContaining(['text', 'instance', 'rectangle']) }
                    }
                }
            }
        }
    });
});

it('expands complete-screen artwork into the existing atomic operation batch', async () => {
    const [copy, peer] = await createCopies(2);
    const operations = readOperations({
        op: 'addScreen',
        key: 'screen',
        screen: { name: 'Screenshot', position: { x: 0, y: 0 }, size: { width: 480, height: 640 } },
        shapes: [
            { key: 'heading', shape: { type: 'text', position: { x: 32, y: 64 }, value: 'Hello' } }
        ]
    });
    expect(copy.store.actions.checkOperations({ documentId: DOCUMENT_ID, operations })).toEqual({
        valid: true
    });
    expect(Object.values(shownDocument(copy).frames)).toHaveLength(0);
    expect(
        copy.store.actions.applyOperations({
            documentId: DOCUMENT_ID,
            operations,
            by: { kind: 'ai', model: 'test', requestId: 'screen-test' }
        })
    ).toMatchObject({ applied: true });
    settle([copy, peer]);
    const document = shownDocument(copy);
    const screen = Object.values(document.frames).find((frame) => frame.kind === 'screen')!;
    expect(Object.values(document.shapes).some((shape) => shape.parentFrameId === screen.id)).toBe(
        true
    );
    expect(Object.values(shownDocument(peer).frames)).toHaveLength(2);
    copy.collaboration.undo(DOCUMENT_ID);
    settle([copy, peer]);
    expect(Object.values(shownDocument(copy).frames)).toHaveLength(0);
    expect(Object.values(shownDocument(peer).shapes)).toHaveLength(0);
    [copy, peer].forEach(({ collaboration }) => collaboration.dispose());
});

it.each(
    [
        [],
        [
            {
                key: 'heading',
                shape: {
                    type: 'text',
                    position: { x: 0, y: 0 },
                    value: 'Hello',
                    parentFrameId: 'other'
                }
            }
        ],
        [{ key: 'heading', shape: { type: 'text', value: 'No position' } }]
    ].map((shapes) => ({ shapes }))
)('rejects incomplete or conflicting screen artwork before it can be proposed', ({ shapes }) => {
    expect(() =>
        readOperations({
            op: 'addScreen',
            key: 'screen',
            screen: {
                name: 'Screenshot',
                position: { x: 0, y: 0 },
                size: { width: 480, height: 640 }
            },
            shapes
        })
    ).toThrow();
});

it('requires geometry in the screenshot authoring schema', () => {
    expect(TOOLS.find((tool) => tool.name === 'addScreen')).toMatchObject({
        parameters: {
            properties: {
                shapes: {
                    minItems: 1,
                    items: { properties: { shape: { required: ['type', 'position'] } } }
                }
            }
        }
    });
});

it('scopes artwork names without rewriting persistent component, property or variable references', async () => {
    const copies = await createCopies(2, (store) => {
        const fixture = prototypeDocument();
        fixture.frames.details.definitionOnly = true;
        store.actions.addDocument({ ...fixture, id: DOCUMENT_ID });
    });
    const [copy, peer] = copies;
    const document = shownDocument(copy);
    const before = sharedContent(copy);
    const component = Object.values(document.components)[0];
    const prop = component.props![0];
    const sourceId = component.shapesIds[0];
    const screen = (key: string) => ({
        op: 'addScreen',
        key,
        screen: { name: key, position: { x: 0, y: 0 }, size: { width: 480, height: 640 } },
        shapes: [
            {
                key: sourceId,
                shape: {
                    type: 'instance',
                    position: { x: 24, y: 24 },
                    componentId: component.id,
                    overrides: { [prop.id]: 'New label' }
                }
            },
            {
                key: 'background',
                shape: {
                    type: 'rectangle',
                    position: { x: 0, y: 0 },
                    size: { width: 480, height: 640 },
                    bindings: { fill: 'ink' }
                }
            }
        ]
    });
    const reserved = [
        ...authoringKeys(document),
        `artwork:${JSON.stringify(['new-screen', sourceId])}`
    ];
    const first = readOperations(screen('new-screen'), reserved);
    const second = readOperations(screen('other-screen'), reserved);
    const operations = [...first, ...second];
    expect(first[1]).toMatchObject({
        key: `artwork:${JSON.stringify(['new-screen', sourceId])}:2`,
        shape: {
            componentId: component.id,
            overrides: { [prop.id]: 'New label' },
            parentFrameId: 'new-screen'
        }
    });
    expect(first[2]).toMatchObject({ shape: { bindings: { fill: 'ink' } } });
    expect(copy.store.actions.checkOperations({ documentId: DOCUMENT_ID, operations })).toEqual({
        valid: true
    });
    expect(sharedContent(copy)).toEqual(before);
    expect(
        copy.store.actions.applyOperations({
            documentId: DOCUMENT_ID,
            operations,
            by: { kind: 'person' }
        }).applied
    ).toBe(true);
    settle(copies);
    expect(sharedContent(copy)).toEqual(sharedContent(peer));
    copy.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(sharedContent(copy)).toEqual(before);
    copies.forEach(({ collaboration }) => collaboration.dispose());
});

it('rejects repeated local artwork keys and keeps ordinary addShape keys unchanged', () => {
    const shape = { type: 'text', position: { x: 0, y: 0 }, value: 'Hello' };
    expect(() =>
        readOperations({
            op: 'addScreen',
            key: 'screen',
            screen: { name: 'Home', position: { x: 0, y: 0 }, size: { width: 480, height: 640 } },
            shapes: [
                { key: 'title', shape },
                { key: 'title', shape }
            ]
        })
    ).toThrow(/repeated within this screen/);
    expect(readOperations({ op: 'addShape', key: 'title', shape })[0]).toMatchObject({
        key: 'title'
    });
});
