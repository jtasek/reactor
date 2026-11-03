import { selectionOperations } from 'src/ui/components/CommandLine/selection';
import { createTestStore } from './support/store';

function setup() {
    const { store } = createTestStore();
    const id = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 80 },
        size: { width: 300, height: 200 }
    })!;
    const run = (input: string) =>
        store.actions.applyOperations({
            documentId: store.state.currentDocumentId,
            by: { kind: 'person' },
            operations: selectionOperations(input, store.state)
        });
    const stack = (frameId = id) =>
        store.actions.editFrame({
            kind: 'update',
            id: frameId,
            changes: { stack: { direction: 'row', gap: 8, padding: 12, align: 'center' } }
        });

    return { store, id, run, stack, frame: () => store.state.currentDocument.frames[id] };
}

it('resizes a frame and moves its children using one validated batch', () => {
    const { store, id, run, frame } = setup();
    store.actions.addShape({
        type: 'rectangle',
        parentFrameId: id,
        position: { x: 120, y: 100 },
        size: { width: 40, height: 20 }
    });
    const shapeId = store.state.currentDocument.shapesIds.at(-1)!;
    expect(run('w=400 height=250').applied).toBe(true);
    expect(frame().size).toEqual({ width: 400, height: 250 });
    expect(run('move x=-20 y=10').applied).toBe(true);
    expect(frame().position).toEqual({ x: 80, y: 90 });
    expect(store.state.currentDocument.shapes[shapeId]).toMatchObject({
        position: { x: 100, y: 110 }
    });
});

it('updates existing stack inputs without changing direction or alignment', () => {
    const { run, stack, frame } = setup();
    expect(() => run('gap=16')).toThrow(/no stack/);
    stack();
    expect(run('gap=16 padding=0 w=400').applied).toBe(true);
    expect(frame().stack).toEqual({ direction: 'row', gap: 16, padding: 0, align: 'center' });
    expect(frame().size.width).toBe(400);
});

it.each([
    'w=0',
    'h=0.5',
    'w=Infinity',
    'gap=-1',
    'padding=NaN',
    'w=300 width=400',
    'r=12',
    'move gap=3'
])('refuses invalid frame input %s', (input) => {
    const { run, frame } = setup();
    expect(() => run(input)).toThrow();
    expect(frame().size).toEqual({ width: 300, height: 200 });
});

it('refuses hidden or locked frames and preserves hug sizing', () => {
    const { store, id, run } = setup();
    store.actions.editFrame({
        kind: 'update',
        id,
        changes: {
            sizing: { width: { mode: 'hug' } },
            stack: { direction: 'row', gap: 0, padding: 0, align: 'start' }
        }
    });
    expect(() => run('w=100')).toThrow(/hug/);
    store.actions.editFrame({ kind: 'toggle', id, flag: 'locked' });
    expect(() => run('h=100')).toThrow(/editable/);
});

it('refuses to move a frame with locked children without moving anything', () => {
    const { store, id, run, frame } = setup();
    store.actions.addShape({
        type: 'rectangle',
        parentFrameId: id,
        locked: true,
        position: { x: 120, y: 100 },
        size: { width: 40, height: 20 }
    });
    expect(run('move x=20').applied).toBe(false);
    expect(frame().position).toEqual({ x: 100, y: 80 });
});

it('detaches only the frame inputs explicitly edited, including equal values', () => {
    const { store, id, run, frame, stack } = setup();
    stack();
    const width = store.actions.createVariable({ name: 'width', type: 'number', value: 300 })!;
    const gap = store.actions.createVariable({ name: 'gap', type: 'number', value: 8 })!;
    const padding = store.actions.createVariable({ name: 'padding', type: 'number', value: 12 })!;
    store.actions.editFrame({ kind: 'update', id, changes: { bindings: { width, gap, padding } } });
    expect(run('w=300 gap=8').applied).toBe(true);
    expect(frame().bindings).toEqual({ padding });
});

function viewSetup() {
    const base = setup();
    const { store, id } = base;
    store.actions.editFrame({ kind: 'update', id, changes: { kind: 'screen' } });
    const viewId = store.state.currentDocument.selectedFrameId!;

    return { ...base, viewId, view: () => store.state.currentDocument.frames[viewId] };
}

it('resizes and moves only the selected view while stack edits target its shared screen', () => {
    const { store, id, viewId, view, frame, run, stack } = viewSetup();
    stack();
    store.actions.editFrame({ kind: 'select', id: viewId });
    expect(run('w=390 h=844').applied).toBe(true);
    expect(view().size).toEqual({ width: 390, height: 844 });
    expect(frame().size).toEqual({ width: 300, height: 200 });
    expect(run('move x=20').applied).toBe(true);
    expect(view().position.x).toBe(120);
    expect(frame().position.x).toBe(100);
    expect(run('gap=16 padding=24').applied).toBe(true);
    expect(store.state.currentDocument.frames[id].stack).toMatchObject({ gap: 16, padding: 24 });
    expect(view().stack).toBeUndefined();
});

it('uses the active responsive layout, retains explicit choices and refuses combined view sizing and stack edits', () => {
    const { store, id, viewId, run, stack, frame, view } = viewSetup();
    stack();
    const layoutId = store.actions.editFrame({ kind: 'addLayout', viewId, name: 'Wide' })!;
    stack(layoutId);
    store.actions.editFrame({
        kind: 'update',
        id,
        changes: { responsiveLayouts: { wide: { minWidth: 600, layoutId } } }
    });
    store.actions.editFrame({
        kind: 'update',
        id: viewId,
        changes: { layoutMode: 'auto', layoutId: null }
    });
    store.actions.editFrame({ kind: 'select', id: viewId });
    expect(() => run('w=800 gap=24')).toThrow(/Resize.*first/);
    expect(view().size.width).toBe(300);
    expect(run('w=800').applied).toBe(true);
    expect(run('gap=24').applied).toBe(true);
    expect(store.state.currentDocument.frames[layoutId].stack?.gap).toBe(24);
    expect(frame().stack?.gap).toBe(8);
    store.actions.editFrame({
        kind: 'update',
        id: viewId,
        changes: { layoutMode: null, layoutId }
    });
    expect(run('w=400').applied).toBe(true);
    expect(run('padding=32').applied).toBe(true);
    expect(view().layoutId).toBe(layoutId);
    expect(store.state.currentDocument.frames[layoutId].stack?.padding).toBe(32);
    store.actions.editFrame({ kind: 'toggle', id: layoutId, flag: 'locked' });
    expect(() => run('gap=40')).toThrow(/unavailable/);
});

it('refuses stack-managed frame movement and layout-definition geometry edits', () => {
    const { store, id, run, frame } = setup();
    const parent = store.actions.editFrame({
        kind: 'add',
        position: { x: 0, y: 0 },
        size: { width: 500, height: 500 }
    })!;
    store.actions.editFrame({
        kind: 'update',
        id: parent,
        changes: { stack: { direction: 'column', gap: 0, padding: 0, align: 'start' } }
    });
    store.actions.editFrame({ kind: 'update', id, changes: { parentFrameId: parent } });
    store.actions.editFrame({ kind: 'select', id });
    expect(run('move x=10').applied).toBe(false);
    expect(frame().position).toEqual({ x: 100, y: 80 });

    const other = viewSetup();
    const layoutId = other.store.actions.editFrame({
        kind: 'addLayout',
        viewId: other.viewId,
        name: 'Other'
    })!;
    other.store.actions.editFrame({ kind: 'select', id: layoutId });
    expect(() => other.run('w=400')).toThrow(/follows its Screen view/);
    expect(() => other.run('move x=10')).toThrow(/follows its Screen view/);
});

it.each(['move x=0', 'move x=0 y=0'])(
    'rejects empty movement for frames and views: %s',
    (input) => {
        for (const { run } of [setup(), viewSetup()]) {
            expect(() => run(input)).toThrow('Move needs a non-zero x or y.');
        }
    }
);
