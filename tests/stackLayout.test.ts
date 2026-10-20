import { drawnBox } from 'src/app/membership';
import { json } from 'overmind';
import { createTestStore } from './support/store';
import {
    createCopies,
    edit,
    settle,
    shownDocument,
    sharedState,
    DOCUMENT_ID
} from './support/collaboration';
import {
    renderedShape,
    renderedFrame,
    projectFrameLayout,
    layoutDocument,
    frameLayout,
    orderAtPosition,
    stackPosition
} from 'src/app/frameLayout';
import {
    serializePersistedState,
    hydrateDocument,
    readEntity,
    SCHEMA_VERSION,
    migratePersistedState
} from 'src/app/services/documentStorage';
import { writeClipboard, readClipboard } from 'src/app/frameEdits';
import type { StackRules } from 'src/app/types';

type Store = ReturnType<typeof createTestStore>['store'];
const rules: StackRules = { direction: 'row', gap: 10, padding: 20, align: 'center' };
const frame = (store: Store, parentFrameId?: string) => {
    const id = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 100 },
        size: { width: 300, height: 200 }
    })!;
    if (parentFrameId) {
        store.actions.editFrame({ kind: 'update', id, changes: { parentFrameId } });
    }

    return id;
};
const shape = (store: Store, parentFrameId: string, width = 40, height = 30) => {
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 500, y: 500 },
        size: { width, height },
        parentFrameId
    });

    return store.state.currentDocument.shapesIds.at(-1)!;
};
const setup = (store: Store) => {
    const root = frame(store);
    const a = shape(store, root);
    const b = shape(store, root, 50, 40);
    store.actions.editFrame({ kind: 'update', id: root, changes: { stack: rules } });

    return { root, a, b };
};

it('projects fixed rows and columns, keeping authored geometry and fixed sizes on overflow', () => {
    const { store } = createTestStore();
    const { root, a, b } = setup(store);
    const document = store.state.currentDocument;
    expect(renderedShape(document, a)).toMatchObject({
        position: { x: 120, y: 185 },
        size: { width: 40, height: 30 }
    });
    expect(renderedShape(document, b)).toMatchObject({
        position: { x: 170, y: 180 },
        size: { width: 50, height: 40 }
    });
    expect(document.shapes[a]).toMatchObject({ position: { x: 500, y: 500 } });
    store.actions.editFrame({
        kind: 'update',
        id: root,
        changes: { stack: { ...rules, direction: 'column', align: 'end' } }
    });
    expect(renderedShape(document, a)).toMatchObject({ position: { x: 340, y: 120 } });
    expect(renderedShape(document, b)).toMatchObject({ position: { x: 330, y: 160 } });
    store.actions.editFrame({
        kind: 'update',
        id: root,
        changes: { size: { width: 50, height: 50 } }
    });
    expect(projectFrameLayout(document).problems[root]).toContain('overflow');
    expect(renderedShape(document, b)).toMatchObject({ size: { width: 50, height: 40 } });
});

it('treats a group as one slot, excludes hidden slots, and keeps layout order independent of z order', () => {
    const { store } = createTestStore();
    const { root, a, b } = setup(store);
    const document = store.state.currentDocument;
    const before = json(renderedShape(document, a));
    store.actions.bringShapesToFront([a]);
    expect(renderedShape(document, a)).toMatchObject({
        position: before.type === 'rectangle' ? before.position : {}
    });
    const distance =
        drawnBox(renderedShape(document, b)).topLeft.x -
        drawnBox(renderedShape(document, a)).topLeft.x;
    store.actions.selectShape(a);
    store.actions.selectShape(b);
    store.actions.groupSelection();
    expect(
        drawnBox(renderedShape(document, b)).topLeft.x -
            drawnBox(renderedShape(document, a)).topLeft.x
    ).toBe(distance);
    const delta = projectFrameLayout(document).shapes;
    expect(delta[a]).toEqual(delta[b]);
    store.actions.hideSelection();
    expect(projectFrameLayout(document).managedShapes.size).toBe(0);
    store.actions.showAll();
    expect(projectFrameLayout(document).managedShapes.has(a)).toBe(true);
    expect(document.frames[root].stack).toEqual(rules);
});

it('keeps nested free content in canvas coordinates and supports detach, free layout and boundary deletion', () => {
    const { store } = createTestStore();
    const root = frame(store);
    const child = frame(store, root);
    const a = shape(store, child);
    store.actions.editFrame({ kind: 'update', id: root, changes: { stack: rules } });
    const document = store.state.currentDocument;
    const visible = json(renderedShape(document, a));
    expect(renderedFrame(document, child).position).toEqual({ x: 120, y: 120 });
    store.actions.editFrame({ kind: 'update', id: child, changes: { parentFrameId: null } });
    expect(renderedShape(document, a)).toEqual(visible);
    store.actions.editFrame({ kind: 'update', id: child, changes: { parentFrameId: root } });
    const placed = json(renderedShape(document, a));
    store.actions.editFrame({ kind: 'update', id: root, changes: { stack: null } });
    expect(renderedShape(document, a)).toEqual(placed);
    store.actions.editFrame({ kind: 'update', id: root, changes: { stack: rules } });
    const final = json(renderedShape(document, a));
    store.actions.editFrame({ kind: 'delete', id: root });
    expect(renderedShape(document, a)).toEqual(final);
    expect(document.frames[child]).not.toHaveProperty('parentFrameId');
});

it('persists rules and order, never offsets, migrates v7 and refuses invalid rules atomically', () => {
    const { store } = createTestStore();
    const { root, a } = setup(store);
    const document = store.state.currentDocument;
    const saved = serializePersistedState(store.state);
    expect(saved.version).toBe(SCHEMA_VERSION);
    expect(saved.documents[document.id]).not.toHaveProperty('frameLayout');
    expect(saved.documents[document.id].shapes[a]).toMatchObject({
        position: { x: 500, y: 500 },
        layoutOrder: 0
    });
    const restored = hydrateDocument(saved.documents[document.id]);
    expect(renderedShape(restored, a)).toMatchObject({ position: { x: 120, y: 185 } });
    expect(migratePersistedState({ ...saved, version: 7 })?.version).toBe(SCHEMA_VERSION);
    for (const changes of [
        { gap: -1 },
        { padding: Infinity },
        { direction: 'diagonal' },
        { align: 'stretch' }
    ]) {
        expect(() =>
            readEntity('frames', {
                ...json(document.frames[root]),
                stack: { ...rules, ...changes }
            })
        ).toThrow();
    }
});

it('keeps stack order and visible geometry through frame copy/paste and clone', () => {
    const { store } = createTestStore();
    const { root, a, b } = setup(store);
    const document = store.state.currentDocument;
    store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            { op: 'updateShape', shape: b, changes: { layoutOrder: 0 } },
            { op: 'updateShape', shape: a, changes: { layoutOrder: 1 } }
        ]
    });
    const copied = readClipboard(writeClipboard(document.frames[root], document))!;
    expect(copied.frame.stack).toEqual(rules);
    expect(copied.artwork.shapes.map((item) => item.layoutOrder)).toEqual([1, 0]);
    store.actions.editFrame({ kind: 'clone', id: root });
    const cloned = document.selectedFrameId!;
    expect(document.frames[cloned].stack).toEqual(rules);
    const children = Object.values(document.shapes).filter((item) => item.parentFrameId === cloned);
    expect(children).toHaveLength(2);
    const view = layoutDocument(document);
    expect(view.shapes[children[0].id]).toMatchObject({ position: { x: 190, y: 195 } });
});

it('reflows two production copies after independent rule and size changes, and undoes only local rules', async () => {
    const copies = await createCopies(2, setup);
    const [a, b] = copies;
    const document = shownDocument(a);
    const root = Object.keys(document.frames)[0];
    const first = document.shapesIds[0];
    edit(a, (actions) =>
        actions.editFrame({ kind: 'update', id: root, changes: { stack: { ...rules, gap: 30 } } })
    );
    edit(b, (actions) => actions.setShapesProperty({ shapeIds: [first], key: 'width', value: 70 }));
    settle(copies);
    expect(projectFrameLayout(document)).toEqual(projectFrameLayout(shownDocument(b)));
    expect(document.frames[root].stack?.gap).toBe(30);
    expect(document.shapes[first]).toMatchObject({
        size: { width: 70, height: 30 },
        position: { x: 500, y: 500 }
    });
    const stable = sharedState(a);
    projectFrameLayout(document);
    projectFrameLayout(shownDocument(b));
    settle(copies);
    expect(sharedState(a)).toEqual(stable);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(document.frames[root].stack?.gap).toBe(10);
    expect(document.shapes[first]).toMatchObject({ size: { width: 70, height: 30 } });
});

it('merges independent nested stack rules through production collaboration', async () => {
    const copies = await createCopies(2, setup);
    const [a, b] = copies;
    const root = Object.keys(shownDocument(a).frames)[0];
    edit(a, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: root,
            changes: { stack: { ...rules, direction: 'column' } }
        })
    );
    edit(b, (actions) =>
        actions.editFrame({ kind: 'update', id: root, changes: { stack: { ...rules, gap: 35 } } })
    );
    settle(copies);
    expect(shownDocument(a).frames[root].stack).toEqual({ ...rules, direction: 'column', gap: 35 });
    expect(projectFrameLayout(shownDocument(a))).toEqual(projectFrameLayout(shownDocument(b)));
});

it('cancels a drag when a remote stack takes over its placement without losing the layout rule', async () => {
    const copies = await createCopies(2, (store) => {
        const root = frame(store);
        shape(store, root);
    });
    const [a, b] = copies;
    const document = shownDocument(a);
    const root = Object.keys(document.frames)[0];
    const child = document.shapesIds[0];
    a.store.actions.events.beginGesture({ pointerId: 1, position: { x: 510, y: 510 } });
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 550, y: 550 } });
    edit(b, (actions) =>
        actions.editFrame({ kind: 'update', id: root, changes: { stack: rules } })
    );
    settle(copies);
    a.store.actions.events.endGesture({ pointerId: 1, position: { x: 560, y: 560 } });
    settle(copies);
    expect(document.shapes[child]).toMatchObject({ position: { x: 500, y: 500 } });
    expect(document.frames[root].stack).toEqual(rules);
    expect(sharedState(a)).toEqual(sharedState(b));
});

it('excludes cyclic parent edges and resolves a deep hierarchy without recursion', () => {
    const { store } = createTestStore();
    const { root, a } = setup(store);
    const snapshot = json(store.state.currentDocument);
    const prototype = snapshot.frames[root];
    snapshot.frames = Object.fromEntries(
        Array.from({ length: 2000 }, (_, index) => [
            String(index),
            {
                ...prototype,
                id: String(index),
                stack: undefined,
                parentFrameId: index === 0 ? undefined : String(index - 1)
            }
        ])
    );
    snapshot.frames['0'].stack = rules;
    snapshot.shapes[a].parentFrameId = '1999';
    expect(projectFrameLayout(snapshot).frames['1999']).toEqual({ x: 20, y: 20 });
    snapshot.frames['0'].parentFrameId = '1';
    expect(projectFrameLayout(snapshot).managedFrames.has('1')).toBe(false);
});

it('uses drawn extents for rotated shapes, paths and text, and falls back safely for a split group', () => {
    const { store } = createTestStore();
    const root = frame(store);
    store.actions.addShape({
        type: 'rectangle',
        name: 'Rotated',
        position: { x: 500, y: 500 },
        size: { width: 80, height: 20 },
        rotation: 90,
        parentFrameId: root
    });
    store.actions.addShape({
        type: 'line',
        name: 'Path',
        start: { x: 500, y: 500 },
        end: { x: 530, y: 520 },
        parentFrameId: root
    });
    store.actions.addShape({
        type: 'text',
        name: 'Label',
        position: { x: 500, y: 500 },
        value: 'Hello',
        fontSize: 20,
        parentFrameId: root
    });
    store.actions.editFrame({
        kind: 'update',
        id: root,
        changes: { stack: { ...rules, align: 'start' } }
    });
    const document = store.state.currentDocument;
    const [rotated, path, label] = document.shapesIds;
    const layout = projectFrameLayout(document);
    const bounds = (id: string) => drawnBox(renderedShape(document, id, layout));
    expect(bounds(rotated).topLeft.x).toBeCloseTo(120);
    expect(bounds(rotated).topLeft.y).toBeCloseTo(120);
    expect(bounds(path).topLeft.x).toBeCloseTo(bounds(rotated).bottomRight.x + rules.gap);
    expect(bounds(label).topLeft.x).toBeCloseTo(bounds(path).bottomRight.x + rules.gap);
    const snapshot = json(document);
    snapshot.groups.broken = {
        id: 'broken',
        name: 'Broken',
        visible: true,
        locked: false,
        selected: false,
        shapesIds: [path, label]
    };
    delete snapshot.shapes[label].parentFrameId;
    expect(projectFrameLayout(snapshot).problems[root]).toContain('same frame');
    expect(projectFrameLayout(snapshot).shapes[path]).toEqual({ x: 0, y: 0 });
});

it('projects a component instance from source dimensions even before browser measurement', () => {
    const { store } = createTestStore();
    const root = frame(store);
    store.actions.addShape({
        type: 'rectangle',
        name: 'Master',
        position: { x: 500, y: 500 },
        size: { width: 80, height: 40 }
    });
    const master = store.state.currentDocument.shapesIds.at(-1)!;
    store.actions.unselectShapes();
    store.actions.selectShape(master);
    store.actions.createComponentFromSelection();
    const document = store.state.currentDocument;
    const instance = Object.values(document.shapes).find((item) => item.type === 'instance')!;
    store.actions.editFrame({ kind: 'reparentShapes', ids: [instance.id], parentFrameId: root });
    store.actions.editFrame({ kind: 'update', id: root, changes: { stack: rules } });
    const saved = serializePersistedState(store.state);
    const restored = hydrateDocument(saved.documents[document.id]);
    expect(drawnBox(renderedShape(restored, instance.id))).toMatchObject({
        topLeft: { x: 120, y: 180 },
        width: 80,
        height: 40
    });
});

it('does not read unrelated free-canvas geometry during stack projection', () => {
    const { store } = createTestStore();
    setup(store);
    const document = json(store.state.currentDocument);
    const original = document.shapes[document.shapesIds[0]];
    document.shapes.outside = {
        ...original,
        id: 'outside',
        parentFrameId: undefined,
        get position(): never {
            throw new Error('Unrelated geometry was read');
        },
        get bounds(): never {
            throw new Error('Unrelated geometry was read');
        }
    };
    document.shapesIds.push('outside');
    expect(() => projectFrameLayout(document)).not.toThrow();
});

it('keeps visible spacing and the stack slot when creating and detaching a component', () => {
    const { store } = createTestStore();
    const { root, a, b } = setup(store);
    const document = store.state.currentDocument;
    const before =
        drawnBox(renderedShape(document, b)).topLeft.x -
        drawnBox(renderedShape(document, a)).topLeft.x;
    store.actions.selectShape(a);
    store.actions.selectShape(b);
    store.actions.createComponentFromSelection();
    const instance = Object.values(document.shapes).find((item) => item.type === 'instance')!;
    expect(drawnBox(renderedShape(document, instance.id)).width).toBe(100);
    store.actions.detachInstances([instance.id]);
    const copies = Object.values(document.shapes).filter((item) => item.parentFrameId === root);
    expect(copies).toHaveLength(2);
    expect(
        drawnBox(renderedShape(document, copies[1].id)).topLeft.x -
            drawnBox(renderedShape(document, copies[0].id)).topLeft.x
    ).toBe(before);
});

it('moves an item to a stack position without tying or changing the other items', () => {
    const { store } = createTestStore();
    const { root, a, b } = setup(store);
    const c = shape(store, root, 20);
    const document = store.state.currentDocument;
    const names = () => projectFrameLayout(document).slots[root].map((slot) => slot.members[0]);
    const moveTo = (id: string, position: number) => {
        const layoutOrder = orderAtPosition(frameLayout(document), root, 'shape', id, position)!;
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [{ op: 'updateShape', shape: id, changes: { layoutOrder } }]
        });
    };
    expect(names()).toEqual([a, b, c]);
    const before = { a: document.shapes[a].layoutOrder, b: document.shapes[b].layoutOrder };

    moveTo(c, 0);
    expect(names()).toEqual([c, a, b]);
    expect(stackPosition(frameLayout(document), root, 'shape', c)).toBe(0);
    moveTo(c, 1);
    expect(names()).toEqual([a, c, b]);
    moveTo(a, 2);
    expect(names()).toEqual([c, b, a]);
    moveTo(a, 0);
    expect(names()).toEqual([a, c, b]);
    expect(document.shapes[b].layoutOrder).toBe(before.b);
    expect(new Set(Object.values(document.shapes).map((item) => item.layoutOrder)).size).toBe(3);

    // An order below the first one survives saving and loading.
    const saved = serializePersistedState(store.state);
    const loaded = hydrateDocument(saved.documents[document.id]);
    expect(loaded.shapes[a].layoutOrder).toBeLessThan(0);
    expect(projectFrameLayout(loaded).slots[root].map((slot) => slot.members[0])).toEqual([
        a,
        c,
        b
    ]);
});

it('orders a cloned stack item after the others', () => {
    const { store } = createTestStore();
    const { root, a, b } = setup(store);
    const document = store.state.currentDocument;
    store.actions.cloneShapes([a]);
    const clone = document.shapesIds.at(-1)!;
    expect(document.shapes[clone].layoutOrder).toBe(2);
    expect(projectFrameLayout(document).slots[root].map((slot) => slot.members[0])).toEqual([
        a,
        b,
        clone
    ]);
});
