import { prototypeDocument } from '../support/prototype';
import { readOperation } from 'src/ai/operations';
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
    expect(Object.keys(context.frames).sort()).toEqual(['compact', 'home', 'mobile']);
    expect(Object.keys(context.shapes).sort()).toEqual(['body', 'compact-body']);
    expect(context.frames.mobile.screenId).toBe('home');
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
