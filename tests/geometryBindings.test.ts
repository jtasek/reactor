import { json } from 'overmind';
import type { HandleTarget } from 'src/events/types';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, sharedContent } from './support/collaboration';

function setup() {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 40, height: 40 },
        selected: true
    });
    const document = store.state.currentDocument;
    const id = document.shapesIds[0];
    const shape = () => document.shapes[id];
    const bind = (key: string, value: number) => {
        const variableId = store.actions.createVariable({ name: key, type: 'number', value })!;
        store.actions.bindProperty({ shapeIds: [id], key, variableId });
        return variableId;
    };
    const x = bind('x', 0),
        y = bind('y', 0),
        rotation = bind('rotation', 0),
        radius = bind('cornerRadius', 0);
    const input = (position: { x: number; y: number }) => ({ pointerId: 1, position, free: true });
    return { store, document, id, shape, bind, x, y, rotation, radius, input };
}

it('keeps click bindings but detaches a moved axis even after dragging back to its original value', () => {
    const { store, id, shape, input, x, y, rotation, radius } = setup();
    const before = json(shape().bindings);
    store.actions.events.beginGesture(input({ x: 20, y: 20 }));
    store.actions.events.endGesture(input({ x: 21, y: 20 }));
    expect(shape().bindings).toEqual(before);
    store.actions.events.beginGesture(input({ x: 20, y: 20 }));
    store.actions.events.movePointer(input({ x: 30, y: 20 }));
    store.actions.events.endGesture(input({ x: 20, y: 20 }));
    expect(shape().bindings).toEqual({ y, rotation, cornerRadius: radius });
    store.actions.setVariableValue({ variableId: x, value: 100 });
    expect(store.state.currentDocument.shapes[id]).toMatchObject({ position: { x: 0, y: 0 } });
});

it.each(['bottomRight', 'rotate', 'radius'] as const)(
    'keeps a %s handle click bound, then detaches a drag and restores on cancel',
    (type) => {
        const { store, id, shape, input } = setup();
        const handle: HandleTarget =
            type === 'radius' ? { type, shapeId: id, corner: 'topLeft' } : { type, shapeId: id };
        const start =
            type === 'bottomRight'
                ? { x: 40, y: 40 }
                : type === 'rotate'
                  ? { x: 20, y: -20 }
                  : { x: 8, y: 8 };
        const before = json(shape());
        store.actions.events.beginGesture({ ...input(start), handle });
        store.actions.events.endGesture(input(start));
        expect(shape().bindings).toEqual(before.bindings);
        store.actions.events.beginGesture({ ...input(start), handle });
        store.actions.events.movePointer(input({ x: start.x + 20, y: start.y + 20 }));
        expect(shape().bindings).not.toEqual(before.bindings);
        store.actions.events.cancelGesture();
        expect(shape().bindings).toEqual(before.bindings);
        expect(shape()).toMatchObject({
            position: before.type === 'rectangle' ? before.position : {},
            rotation: before.rotation
        });
    }
);

it('detaches a clamped radius write even when the radius stays zero', () => {
    const { store, id, shape, input, radius } = setup();
    store.actions.events.beginGesture({
        ...input({ x: 8, y: 8 }),
        handle: { type: 'radius', shapeId: id, corner: 'topLeft' }
    });
    store.actions.events.endGesture(input({ x: 0, y: 0 }));
    expect(shape().bindings?.cornerRadius).toBeUndefined();
    expect(shape()).toMatchObject({ cornerRadius: 0 });
    store.actions.setVariableValue({ variableId: radius, value: 10 });
    expect(shape()).toMatchObject({ cornerRadius: 0 });
});

it('detaches resize position writes even when their coordinates remain the same, keeping radius and rotation', () => {
    const { store, id, shape, input, radius, rotation } = setup();
    store.actions.events.beginGesture({
        ...input({ x: 40, y: 40 }),
        handle: { type: 'bottomRight', shapeId: id }
    });
    store.actions.events.endGesture(input({ x: 60, y: 60 }));
    expect(shape().bindings).toEqual({ cornerRadius: radius, rotation });
    expect(shape()).toMatchObject({ position: { x: 0, y: 0 } });
});

it('detaches only translated axes for arrow and alignment actions', () => {
    const { store, shape, y, rotation, radius } = setup();
    store.actions.moveSelectedShapes({ x: 1, y: 0 });
    expect(shape().bindings).toEqual({ y, rotation, cornerRadius: radius });
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 100, y: 100 },
        size: { width: 40, height: 40 },
        selected: true
    });
    store.actions.alignSelection('bottom');
    expect(shape().bindings).toEqual({ rotation, cornerRadius: radius });
});

it.each(['group', 'component'] as const)(
    '%s scaling detaches its indirect corner radius and text size edits, including zero radius',
    (container) => {
        const { store, document, id, shape, input, rotation } = setup();
        store.actions.addShape({
            type: 'text',
            position: { x: 60, y: 0 },
            value: 'Text',
            fontSize: 12,
            selected: true
        });
        const textId = document.shapesIds[1];
        const font = store.actions.createVariable({ name: 'Font', type: 'number', value: 12 })!;
        store.actions.bindProperty({ shapeIds: [textId], key: 'fontSize', variableId: font });
        if (container === 'group') store.actions.groupSelection();
        else store.actions.addComponent({ shapesIds: [id, textId] });
        const owner =
            container === 'group'
                ? { groupId: Object.keys(document.groups)[0] }
                : { componentId: Object.keys(document.components)[0] };
        store.actions.events.beginGesture({
            ...input({ x: 100, y: 40 }),
            handle: { type: 'bottomRight', ...owner }
        });
        store.actions.events.endGesture(input({ x: 200, y: 80 }));
        expect(shape().bindings).toEqual({ rotation });
        expect(document.shapes[textId].bindings?.fontSize).toBeUndefined();
        expect(document.shapes[id]).toMatchObject({ cornerRadius: 0 });
    }
);

it('group rotation detaches member positions and angles but keeps radius bindings', () => {
    const { store, document, shape, input, radius } = setup();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 60, y: 0 },
        size: { width: 40, height: 40 },
        selected: true
    });
    store.actions.groupSelection();
    const groupId = Object.keys(document.groups)[0];
    store.actions.events.beginGesture({
        ...input({ x: 50, y: -20 }),
        handle: { type: 'rotate', groupId }
    });
    store.actions.events.endGesture(input({ x: 100, y: 20 }));
    expect(shape().bindings).toEqual({ cornerRadius: radius });
});

it('shares a committed move and restores its binding and value with undo', async () => {
    let id = '',
        x = '';
    const copies = await createCopies(2, (store) => {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 0, y: 0 },
            size: { width: 40, height: 40 },
            selected: true
        });
        id = store.state.currentDocument.shapesIds[0];
        x = store.actions.createVariable({ name: 'X', type: 'number', value: 0 })!;
        store.actions.bindProperty({ shapeIds: [id], key: 'x', variableId: x });
    });
    const [a, b] = copies;
    edit(a, (actions) => {
        actions.events.beginGesture({ pointerId: 1, position: { x: 20, y: 20 } });
        actions.events.endGesture({ pointerId: 1, position: { x: 30, y: 20 }, free: true });
    });
    settle(copies);
    expect(shownDocument(b).shapes[id].bindings).toBeUndefined();
    a.collaboration.undo(shownDocument(a).id);
    settle(copies);
    expect(shownDocument(b).shapes[id]).toMatchObject({
        position: { x: 0, y: 0 },
        bindings: { x }
    });
    expect(sharedContent(a)).toEqual(sharedContent(b));
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('cancel restores bindings rebased on another copy’s edits', async () => {
    let id = '',
        x = '';
    const copies = await createCopies(2, (store) => {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 0, y: 0 },
            size: { width: 40, height: 40 },
            selected: true
        });
        id = store.state.currentDocument.shapesIds[0];
        x = store.actions.createVariable({ name: 'X', type: 'number', value: 0 })!;
        store.actions.bindProperty({ shapeIds: [id], key: 'x', variableId: x });
    });
    const [a, b] = copies;
    a.store.actions.events.beginGesture({ pointerId: 1, position: { x: 20, y: 20 } });
    a.store.actions.events.movePointer({ pointerId: 1, position: { x: 30, y: 20 }, free: true });
    edit(b, (actions) => actions.setVariableValue({ variableId: x, value: 50 }));
    settle(copies);
    a.store.actions.events.cancelGesture();
    settle(copies);
    expect(shownDocument(a).shapes[id]).toMatchObject({
        position: { x: 50, y: 0 },
        bindings: { x }
    });
    expect(sharedContent(a)).toEqual(sharedContent(b));
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('a circle radius operation detaches its indirectly changed coordinates even for the same radius', () => {
    const { store } = createTestStore();
    store.actions.addShape({ type: 'circle', position: { x: 10, y: 10 }, radius: 10 });
    const document = store.state.currentDocument;
    const id = document.shapesIds[0];
    const zero = store.actions.createVariable({ name: 'Zero', type: 'number', value: 0 })!;
    for (const key of ['x', 'y'])
        store.actions.bindProperty({ shapeIds: [id], key, variableId: zero });
    const result = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [{ op: 'updateShape', shape: id, changes: { radius: 10 } }]
    });
    expect(result.applied).toBe(true);
    expect(document.shapes[id].bindings).toBeUndefined();
});

it('an inspector font-size edit detaches the text baseline coordinate but preserves X', () => {
    const { store } = createTestStore();
    store.actions.addShape({ type: 'text', position: { x: 0, y: 0 }, value: 'Text', fontSize: 12 });
    const document = store.state.currentDocument;
    const id = document.shapesIds[0];
    const zero = store.actions.createVariable({ name: 'Zero', type: 'number', value: 0 })!;
    for (const key of ['x', 'y'])
        store.actions.bindProperty({ shapeIds: [id], key, variableId: zero });
    store.actions.setShapesProperty({ shapeIds: [id], key: 'fontSize', value: 12 });
    expect(document.shapes[id].bindings).toEqual({ x: zero });
});
