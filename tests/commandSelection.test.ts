import { selectionOperations } from 'src/ui/components/CommandLine/selection';
import { createTestStore } from './support/store';

function setup() {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 80, height: 40 }
    });
    const id = store.state.currentDocument.shapesIds.at(-1)!;
    store.actions.selectShape(id);
    const run = (input: string) =>
        store.actions.applyOperations({
            documentId: store.state.currentDocumentId,
            by: { kind: 'person' },
            operations: selectionOperations(input, store.state)
        });

    return { store, id, run, shape: () => store.state.currentDocument.shapes[id] };
}

it('edits dimensions before radius, with the same aliases as creation', () => {
    const { run, shape } = setup();
    expect(run('r=24 w=240 height=48').applied).toBe(true);
    expect(shape()).toMatchObject({ size: { width: 240, height: 48 }, cornerRadius: 24 });
});

it('moves by signed offsets without replacing an unchanged axis binding', () => {
    const { store, id, run, shape } = setup();
    store.actions.createVariable({ name: 'top', type: 'number', value: 20 });
    const variableId = Object.keys(store.state.currentDocument.variables)[0];
    store.actions.bindProperty({ shapeIds: [id], key: 'y', variableId });
    expect(run('move x=-15').applied).toBe(true);
    expect(shape()).toMatchObject({ position: { x: -5, y: 20 }, bindings: { y: variableId } });
});

it.each(['w=0', 'h=-1', 'r=-1', 'w=NaN', 'w=20 width=40', 'w=', 'move x=Infinity', 'move w=20'])(
    'rejects invalid input %s without changing artwork',
    (input) => {
        const { run, shape } = setup();
        expect(() => run(input)).toThrow();
        expect(shape()).toMatchObject({
            size: { width: 80, height: 40 },
            position: { x: 10, y: 20 }
        });
    }
);

it('rejects empty and locked selections', () => {
    const { store, run, id } = setup();
    store.actions.lockShape(id);
    expect(() => run('w=100')).toThrow();
    store.actions.unselectShapes();
    expect(() => run('w=100')).toThrow(/Select shapes/);
});

it('edits a circle radius but rejects rectangle-only sizing', () => {
    const { store, run } = setup();
    store.actions.addShape({ type: 'circle', position: { x: 40, y: 40 }, radius: 10 });
    const id = store.state.currentDocument.shapesIds.at(-1)!;
    store.actions.unselectShapes();
    store.actions.selectShape(id);
    expect(run('radius=24').applied).toBe(true);
    expect(store.state.currentDocument.shapes[id]).toMatchObject({ radius: 24 });
    expect(() => run('w=100')).toThrow(/cannot be edited/);
    expect(() => run('r=0')).toThrow(/positive/);
});

it('validates every selected shape before applying any edit', () => {
    const { store, run, id, shape } = setup();
    store.actions.addShape({ type: 'circle', position: { x: 40, y: 40 }, radius: 10 });
    store.actions.selectShape(store.state.currentDocument.shapesIds.at(-1)!);
    store.actions.selectShape(id);
    expect(store.state.currentDocument.selectedShapesIds).toHaveLength(2);
    expect(() => run('w=200')).toThrow();
    expect(shape()).toMatchObject({ size: { width: 80, height: 40 } });
    expect(run('move x=10 y=5').applied).toBe(true);
    expect(shape()).toMatchObject({ position: { x: 20, y: 25 } });
});

it('allows fixed sizing in stacks but refuses movement and fill sizing', () => {
    const { store, run, id } = setup();
    const frameId = store.actions.editFrame({
        kind: 'add',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({
        kind: 'update',
        id: frameId,
        changes: { stack: { direction: 'row', padding: 10, gap: 8, align: 'start' } }
    });
    store.actions.updateShape({ id, parentFrameId: frameId });
    store.actions.selectShape(id);
    expect(run('w=150').applied).toBe(true);
    expect(() => run('move x=10')).toThrow(/Stack/);
    store.actions.updateShape({ id, sizing: { width: { mode: 'fill' } } });
    expect(() => run('w=200')).toThrow(/cannot be edited/);
});

it('detaches an explicitly assigned width even when equal, keeping the height binding', () => {
    const { store, id, run, shape } = setup();
    const width = store.actions.createVariable({ name: 'width', type: 'number', value: 80 })!;
    const height = store.actions.createVariable({ name: 'height', type: 'number', value: 40 })!;
    store.actions.bindProperty({ shapeIds: [id], key: 'width', variableId: width });
    store.actions.bindProperty({ shapeIds: [id], key: 'height', variableId: height });
    expect(run('w=80').applied).toBe(true);
    expect(shape().bindings).toEqual({ height });
});

it('refuses a move that changes nothing', () => {
    const { run, shape } = setup();
    expect(() => run('move x=0 y=0')).toThrow(/non-zero/);
    expect(() => run('move x=0')).toThrow(/non-zero/);
    expect(shape()).toMatchObject({ position: { x: 10, y: 20 } });
});

it('refuses width and height together on an image, which keeps its proportions', () => {
    const { store, run } = setup();
    store.actions.addShape({
        type: 'image',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
        href: 'data:image/png;base64,iVBORw0KGgo='
    } as never);
    const id = store.state.currentDocument.shapesIds.at(-1)!;
    store.actions.unselectShapes();
    store.actions.selectShape(id);
    expect(() => run('w=240 h=48')).toThrow(/keeps its proportions/);
});
