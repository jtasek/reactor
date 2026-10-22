import { json } from 'overmind';
import { createTestStore } from './support/store';
import { createDocument, createShape } from 'src/app/factories';
import {
    projectFrameLayout,
    renderedFrame,
    renderedShape,
    layoutDocument
} from 'src/app/frameLayout';
import {
    SCHEMA_VERSION,
    readEntity,
    migratePersistedState,
    serializePersistedState,
    hydrateDocument
} from 'src/app/services/documentStorage';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import { writeClipboard, readClipboard } from 'src/app/frameEdits';
import type { Frame, Sizing } from 'src/app/types';

const frame = (id: string, options: Partial<Frame> = {}): Frame => ({
    id,
    name: id,
    position: { x: 100, y: 100 },
    size: { width: 300, height: 200 },
    locked: false,
    visible: true,
    stack: { direction: 'row', gap: 10, padding: 20, align: 'start' },
    ...options
});
const rectangle = (id: string, sizing?: Sizing, width = 40, height = 30) => ({
    ...createShape({
        type: 'rectangle',
        name: id,
        order: `a${id === 'a' ? '0' : '1'}`,
        position: { x: 500, y: 500 },
        size: { width, height },
        parentFrameId: 'root',
        sizing
    }),
    id
});
const fixture = (sizing?: Sizing, rootSizing?: Sizing) =>
    createDocument({
        id: 'sizing',
        frames: { root: frame('root', { sizing: rootSizing }) },
        shapes: { a: rectangle('a', sizing), b: rectangle('b') }
    });

it('can cancel safely before editor gesture implementations load', () => {
    const { store } = createTestStore({}, { editorLoaded: false });
    expect(store.actions.events.cancelGesture()).toBeNull();
    expect(store.state.events.pointer.gesture.kind).toBe('idle');
});

it('hugs content on both axes, includes gaps/padding and excludes hidden slots', () => {
    const document = fixture(undefined, { width: { mode: 'hug' }, height: { mode: 'hug' } });
    expect(renderedFrame(document, 'root').size).toEqual({ width: 130, height: 70 });
    expect(document.frames.root.size).toEqual({ width: 300, height: 200 });
    document.shapes.b.visible = false;
    expect(renderedFrame(document, 'root').size).toEqual({ width: 80, height: 70 });
    delete document.shapes.a;
    expect(renderedFrame(document, 'root').size).toEqual({ width: 40, height: 40 });
});

it('preserves valid zero-sized fixed rectangles instead of adding an implicit minimum', () => {
    const document = fixture();
    document.shapes.a = rectangle('a', undefined, 0, 0);
    expect(renderedShape(document, 'a')).toMatchObject({ size: { width: 0, height: 0 } });
});

it.each(['row', 'column'] as const)(
    'fills remaining %s space and the cross axis, clamped by constraints',
    (direction) => {
        const document = fixture({
            width: { mode: 'fill', max: 180 },
            height: { mode: 'fill', max: 100 }
        });
        document.frames.root.stack!.direction = direction;
        expect(renderedShape(document, 'a')).toMatchObject({
            size: { width: 180, height: 100 }
        });
        expect(document.shapes.a).toMatchObject({ size: { width: 40, height: 30 } });
    }
);

it('redistributes capped fill shares without violating feasible minimums', () => {
    const document = fixture({ width: { mode: 'fill', min: 180 } });
    document.shapes.b.sizing = { width: { mode: 'fill', max: 80 } };
    // Inner width 260 less one gap: 250, so 180 + 70 fits.
    expect(renderedShape(document, 'a')).toMatchObject({ size: { width: 180 } });
    expect(renderedShape(document, 'b')).toMatchObject({
        size: { width: 70 },
        position: { x: 310 }
    });
    document.shapes.a.sizing = { width: { mode: 'fill', max: 50 } };
    document.shapes.b.sizing = { width: { mode: 'fill' } };
    expect(renderedShape(document, 'a')).toMatchObject({ size: { width: 50 } });
    expect(renderedShape(document, 'b')).toMatchObject({ size: { width: 200 } });
});

it('keeps minimums on overflow and diagnoses conflicting min/max without losing entities', () => {
    const document = fixture({ width: { mode: 'fill', min: 300, max: 50 } });
    expect(renderedShape(document, 'a')).toMatchObject({ size: { width: 300 } });
    const layout = projectFrameLayout(document);
    expect(layout.problems.a).toContain('Maximum is below minimum');
    expect(layout.problems.root).toContain('overflow');
    expect(readEntity('shapes', json(document.shapes.a)).sizing?.width).toEqual({
        mode: 'fill',
        min: 300,
        max: 50
    });
});

it('resolves nested hug and fill, diagnosing only cyclic axes and keeping descendants finite', () => {
    const document = fixture({ width: { mode: 'fill' } }, { width: { mode: 'hug' } });
    document.frames.child = frame('child', {
        parentFrameId: 'root',
        sizing: { width: { mode: 'fill' }, height: { mode: 'hug' } }
    });
    document.frames.leaf = frame('leaf', {
        parentFrameId: 'child',
        sizing: { width: { mode: 'fill' } }
    });
    const layout = projectFrameLayout(document);
    expect(layout.problems.root).toContain('Width: Sizing cycle');
    expect(layout.problems.child).toContain('Width: Sizing cycle');
    expect(layout.problems.a).toContain('Width: Sizing cycle');
    expect(layout.problems.leaf ?? '').not.toContain('cycle');
    expect(layout.frameSizes.root.width).toBe(300);
    expect(layout.frameSizes.child.width).toBe(300);
    expect(layout.frameSizes.leaf.width).toBe(260);
    expect(layout.frameSizes.child.height).toBe(240);
    expect(JSON.stringify(layoutDocument(document))).not.toContain('null');
    document.frames.root.sizing = { width: { mode: 'fixed' } };
    expect(projectFrameLayout(document).problems.root ?? '').not.toContain('cycle');
});

it('clamps fixed/hug sizes and explains unavailable fill/hug contexts', () => {
    const document = fixture(undefined, {
        width: { mode: 'fixed', max: 100 },
        height: { mode: 'hug', min: 90 }
    });
    expect(renderedFrame(document, 'root').size).toEqual({ width: 100, height: 90 });
    document.frames.root.stack = undefined;
    document.frames.root.sizing = { width: { mode: 'fill' }, height: { mode: 'hug' } };
    expect(projectFrameLayout(document).problems.root).toContain('Fill requires a parent');
    expect(projectFrameLayout(document).problems.root).toContain('Hug requires a row');
});

it('keeps outer dependents out of inner-cycle diagnostics and is independent of record order', () => {
    const document = fixture(undefined, { width: { mode: 'hug' } });
    document.frames.child = frame('child', {
        parentFrameId: 'root',
        sizing: { width: { mode: 'hug' } }
    });
    document.frames.leaf = frame('leaf', {
        parentFrameId: 'child',
        sizing: { width: { mode: 'fill' } }
    });
    const result = projectFrameLayout(document);
    expect(result.problems.root ?? '').not.toContain('cycle');
    expect(result.problems.child).toContain('cycle');
    expect(result.problems.leaf).toContain('cycle');
    document.frames = Object.fromEntries(Object.entries(document.frames).reverse());
    document.shapes = Object.fromEntries(Object.entries(document.shapes).reverse());
    expect(projectFrameLayout(document)).toEqual(result);
});

it('evaluates 2,000 nested sizing dependencies without recursion', () => {
    const document = createDocument({
        id: 'deep-sizing',
        frames: Object.fromEntries(
            Array.from({ length: 2000 }, (_, index) => [
                String(index),
                frame(String(index), {
                    parentFrameId: index === 0 ? undefined : String(index - 1),
                    stack: { direction: 'column', gap: 0, padding: 0, align: 'start' },
                    sizing: index === 0 ? undefined : { width: { mode: 'fill' } }
                })
            ])
        )
    });
    expect(projectFrameLayout(document).frameSizes['1999']).toEqual({ width: 300, height: 200 });
});

it('retains intrinsic rotated/grouped geometry and diagnoses unsupported sizing', () => {
    const document = fixture({ width: { mode: 'fill' } });
    document.shapes.a.rotation = 45;
    expect(projectFrameLayout(document).problems.a).toContain('unrotated');
    expect(renderedShape(document, 'a')).toMatchObject({ size: { width: 40 } });
    document.shapes.a.rotation = 0;
    document.groups.g = {
        id: 'g',
        name: 'Group',
        shapesIds: ['a', 'b'],
        locked: false,
        selected: false,
        visible: true
    };
    expect(projectFrameLayout(document).problems.a).toContain('ungrouped');
});

it('persists authored rules and fallback sizes in the current schema, accepts v8, and rejects invalid rules', () => {
    const document = fixture(
        { width: { mode: 'fill', min: 20, max: 100 } },
        { height: { mode: 'hug' } }
    );
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    expect(saved.version).toBe(SCHEMA_VERSION);
    expect(saved.documents[document.id].shapes.a).toMatchObject({
        size: { width: 40 },
        sizing: { width: { mode: 'fill', min: 20, max: 100 } }
    });
    expect(saved.documents[document.id]).not.toHaveProperty('frameLayout');
    const migrated = migratePersistedState({ ...saved, version: 8 })!;
    expect(renderedShape(hydrateDocument(migrated.documents[document.id]), 'a')).toMatchObject({
        size: { width: 100 }
    });
    for (const sizing of [
        { width: { mode: 'other' } },
        { width: { mode: 'fill', min: -1 } },
        { height: { mode: 'fixed', max: Infinity } },
        { depth: { mode: 'hug' } }
    ]) {
        expect(() => readEntity('frames', { ...document.frames.root, sizing })).toThrow();
    }
});

it('applies rules through operations, keeps measured sizes out of authored data, and bakes detach geometry', () => {
    const { store } = createTestStore();
    const id = store.state.currentDocumentId;
    const root = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 100 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({ kind: 'update', id: root, changes: { stack: frame('root').stack } });
    store.actions.addShape({
        type: 'rectangle',
        parentFrameId: root,
        position: { x: 500, y: 500 },
        size: { width: 40, height: 30 }
    });
    const a = store.state.currentDocument.shapesIds.at(-1)!;
    const variableId = store.actions.createVariable({ name: 'width', type: 'number', value: 40 })!;
    store.actions.bindProperty({ shapeIds: [a], key: 'width', variableId });
    expect(store.state.currentDocument.shapes[a].bindings?.width).toBe(variableId);
    const result = store.actions.applyOperations({
        documentId: id,
        by: { kind: 'person' },
        operations: [
            { op: 'updateShape', shape: a, changes: { sizing: { width: { mode: 'fill' } } } }
        ]
    });
    expect(result.applied).toBe(true);
    const shown = renderedShape(store.state.currentDocument, a);
    expect(shown).toMatchObject({ size: { width: 260 } });
    store.actions.setShapeBounds({
        id: a,
        bounds: {
            topLeft: { x: 120, y: 120 },
            bottomRight: { x: 380, y: 150 },
            width: 260,
            height: 30
        }
    });
    expect(store.state.currentDocument.shapes[a]).toMatchObject({ size: { width: 40 } });
    store.actions.editFrame({ kind: 'reparentShapes', ids: [a], parentFrameId: null });
    expect(renderedShape(store.state.currentDocument, a)).toMatchObject({
        position: { x: 120, y: 120 },
        size: { width: 260 }
    });
    expect(store.state.currentDocument.shapes[a].bindings?.width).toBeUndefined();
});

it('copies sized frame subtrees with rules intact', () => {
    const { store } = createTestStore();
    const root = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 100 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({
        kind: 'update',
        id: root,
        changes: { stack: frame('root').stack, sizing: { width: { mode: 'hug', min: 80 } } }
    });
    const copied = readClipboard(
        writeClipboard(store.state.currentDocument.frames[root], store.state.currentDocument)
    );
    expect(copied).not.toBeNull();
    store.actions.editFrame({ kind: 'clone', id: root });
    expect(
        Object.values(store.state.currentDocument.frames).filter((item) => item.id !== root)[0]
            .sizing
    ).toEqual({ width: { mode: 'hug', min: 80 } });
});

it('merges independent sizing edits and cycles across production copies, with shared undo and no projection feedback', async () => {
    const copies = await createCopies(2, (store) => {
        const root = store.actions.editFrame({
            kind: 'add',
            position: { x: 100, y: 100 },
            size: { width: 300, height: 200 }
        })!;
        store.actions.editFrame({
            kind: 'update',
            id: root,
            changes: { stack: frame('root').stack }
        });
        store.actions.addShape({
            type: 'rectangle',
            parentFrameId: root,
            position: { x: 500, y: 500 },
            size: { width: 40, height: 30 },
            sizing: { width: { mode: 'fill' } }
        });
    });
    const [a, b] = copies;
    const root = Object.keys(shownDocument(a).frames)[0];
    edit(a, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: root,
            changes: { sizing: { width: { mode: 'hug' } } }
        })
    );
    edit(b, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: root,
            changes: { stack: { ...shownDocument(b).frames[root].stack!, padding: 30 } }
        })
    );
    settle(copies);
    expect(projectFrameLayout(shownDocument(a))).toEqual(projectFrameLayout(shownDocument(b)));
    expect(projectFrameLayout(shownDocument(a)).problems[root]).toContain('cycle');
    expect(shownDocument(a).frames[root].sizing?.width?.mode).toBe('hug');
    expect(shownDocument(a).frames[root].stack?.padding).toBe(30);
    const before = json(shownDocument(a).frames);
    projectFrameLayout(shownDocument(a));
    a.collaboration.flush();
    expect(b.inbox).toHaveLength(0);
    expect(json(shownDocument(a).frames)).toEqual(before);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).frames[root].sizing).toBeUndefined();
    expect(shownDocument(b).frames[root].stack?.padding).toBe(30);
});

it('retains and diagnoses min/max conflicts produced by concurrent edits, and undoes only the local bound', async () => {
    const copies = await createCopies(2, (store) => {
        const root = store.actions.editFrame({
            kind: 'add',
            position: { x: 0, y: 0 },
            size: { width: 300, height: 200 }
        })!;
        store.actions.editFrame({
            kind: 'update',
            id: root,
            changes: { stack: frame('root').stack }
        });
        store.actions.addShape({
            type: 'rectangle',
            parentFrameId: root,
            position: { x: 0, y: 0 },
            size: { width: 40, height: 30 },
            sizing: { width: { mode: 'fill', min: 20, max: 100 } }
        });
    });
    const [a, b] = copies;
    const id = shownDocument(a).shapesIds[0];
    const update = (copy: typeof a, min: number, max: number) =>
        edit(copy, (actions) =>
            actions.applyOperations({
                documentId: DOCUMENT_ID,
                by: { kind: 'person' },
                operations: [
                    {
                        op: 'updateShape',
                        shape: id,
                        changes: { sizing: { width: { mode: 'fill', min, max } } }
                    }
                ]
            })
        );
    update(a, 140, 100);
    update(b, 20, 80);
    settle(copies);
    expect(shownDocument(a).shapes[id].sizing?.width).toEqual({ mode: 'fill', min: 140, max: 80 });
    expect(projectFrameLayout(shownDocument(a)).problems[id]).toContain('Maximum is below minimum');
    expect(projectFrameLayout(shownDocument(a))).toEqual(projectFrameLayout(shownDocument(b)));
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).shapes[id].sizing?.width).toEqual({ mode: 'fill', min: 20, max: 80 });
});

describe('canvas transforms of sized frames', () => {
    const drag = (
        store: ReturnType<typeof createTestStore>['store'],
        id: string,
        type: 'move' | 'bottomRight'
    ) => {
        const started = store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 400, y: 300 },
            handle: { frameId: id, type }
        });
        store.actions.events.movePointer({ pointerId: 1, position: { x: 450, y: 340 } });
        store.actions.events.endGesture({ pointerId: 1, position: { x: 450, y: 340 } });

        return started;
    };
    const addFrame = (store: ReturnType<typeof createTestStore>['store'], changes: object) => {
        const id = store.actions.editFrame({
            kind: 'add',
            position: { x: 100, y: 100 },
            size: { width: 300, height: 200 }
        })!;
        store.actions.editFrame({ kind: 'update', id, changes });

        return id;
    };

    it('moves a top-level Hug stack but does not resize it', () => {
        const { store } = createTestStore();
        const id = addFrame(store, {
            stack: frame('root').stack,
            sizing: { width: { mode: 'hug' } }
        });
        const frames = () => store.state.currentDocument.frames;
        expect(drag(store, id, 'move')).toBe(true);
        expect(frames()[id].position).toEqual({ x: 150, y: 140 });
        expect(drag(store, id, 'bottomRight')).toBe(false);
        expect(frames()[id].size).toEqual({ width: 300, height: 200 });
    });

    it('moves and resizes a free frame that only has constraints it meets', () => {
        const { store } = createTestStore();
        const id = addFrame(store, { sizing: { width: { mode: 'fixed', min: 10 } } });
        expect(drag(store, id, 'bottomRight')).toBe(true);
        expect(store.state.currentDocument.frames[id].size).toEqual({ width: 350, height: 240 });
        expect(drag(store, id, 'move')).toBe(true);
        expect(store.state.currentDocument.frames[id].position).toEqual({ x: 150, y: 140 });
    });
});

it('drops sizing rules from rectangles leaving stack control, so no stale warning stays', () => {
    const { store } = createTestStore();
    const id = store.state.currentDocumentId;
    const root = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 100 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({ kind: 'update', id: root, changes: { stack: frame('root').stack } });
    const add = () => {
        store.actions.addShape({
            type: 'rectangle',
            parentFrameId: root,
            position: { x: 500, y: 500 },
            size: { width: 40, height: 30 },
            sizing: { width: { mode: 'fill' } }
        });

        return store.state.currentDocument.shapesIds.at(-1)!;
    };
    const [a, b, c] = [add(), add(), add()];
    const problems = () => projectFrameLayout(store.state.currentDocument).problems;
    store.actions.editFrame({ kind: 'reparentShapes', ids: [a], parentFrameId: null });
    expect(store.state.currentDocument.shapes[a].sizing).toBeUndefined();
    expect(problems()[a]).toBeUndefined();
    store.actions.selectShape(b);
    store.actions.selectShape(c);
    store.actions.groupSelection();
    expect(store.state.currentDocument.shapes[b].sizing).toBeUndefined();
    expect(problems()[b]).toBeUndefined();
    expect(
        store.actions.applyOperations({
            documentId: id,
            by: { kind: 'person' },
            operations: [
                { op: 'updateShape', shape: a, changes: { sizing: { width: { mode: 'fixed' } } } }
            ]
        }).applied
    ).toBe(true);
    expect(problems()[a]).toBeUndefined();
});
