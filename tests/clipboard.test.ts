import type { ShapeInput } from 'src/app/types';
import { shapeGeometry } from 'src/app/utils';
import { createTestStore } from './support/store';

const shapes: ShapeInput[] = [
    { type: 'rectangle', position: { x: 10, y: 20 }, size: { width: 40, height: 30 } },
    {
        type: 'image',
        position: { x: 10, y: 20 },
        size: { width: 40, height: 20 },
        source: 'image.png'
    },
    { type: 'circle', position: { x: 50, y: 50 }, radius: 10 },
    { type: 'ellipse', position: { x: 50, y: 50 }, radius: { x: 20, y: 10 } },
    { type: 'line', start: { x: 0, y: 0 }, end: { x: 40, y: 30 } },
    {
        type: 'pen',
        points: [
            { x: 0, y: 0 },
            { x: 10, y: 20 },
            { x: 40, y: 30 }
        ]
    },
    { type: 'text', position: { x: 10, y: 40 }, value: 'abc', fontSize: 20 }
];

function storeWith(...inputs: ShapeInput[]) {
    const { store } = createTestStore();

    inputs.forEach((input) => store.actions.addShape({ ...input, selected: true }));

    const document = () => store.state.currentDocument;
    const ordered = () => document().shapesIds.map((id) => document().shapes[id]);

    return { store, document, ordered };
}

describe.each(shapes)('copying a $type', (shape) => {
    it('pastes into another document as it was drawn, with its name and rotation', () => {
        const { store, ordered } = storeWith({ ...shape, name: 'Original', rotation: 30 });
        const geometry = shapeGeometry(ordered()[0]);
        const copied = store.actions.copySelection();

        store.actions.newDocument();

        expect(store.actions.pasteShapes(copied!)).toBe(true);
        expect(ordered()).toHaveLength(1);
        expect(shapeGeometry(ordered()[0])).toEqual(geometry);
        expect(ordered()[0]).toMatchObject({
            name: 'Original',
            rotation: 30,
            selected: true,
            locked: false,
            visible: true
        });
    });
});

it('pastes into the same document offset from the copies already there', () => {
    const { store, document, ordered } = storeWith(shapes[0], shapes[2]);
    const copied = store.actions.copySelection()!;

    store.actions.pasteShapes(copied);
    store.actions.pasteShapes(copied);

    const [rectangle, circle, ...pasted] = ordered();

    expect(pasted).toHaveLength(4);
    expect(pasted.map((shape) => 'position' in shape && shape.position)).toEqual([
        { x: 20, y: 30 },
        { x: 60, y: 60 },
        { x: 30, y: 40 },
        { x: 70, y: 70 }
    ]);
    expect(new Set(document().shapesIds).size).toBe(6);
    expect([rectangle.selected, circle.selected]).toEqual([false, false]);
    expect(pasted.map((shape) => shape.selected)).toEqual([false, false, true, true]);
});

it('copies selected shapes in drawing order, without memberships or locks', () => {
    const { store, document, ordered } = storeWith(shapes[0], shapes[2]);
    const [rectangle, circle] = document().shapesIds;

    store.actions.addGroup({ shapesIds: [rectangle, circle] });
    store.actions.bringShapesToFront([rectangle]);
    store.actions.lockShape(rectangle);

    const copied = store.actions.copySelection()!;

    store.actions.newDocument();
    store.actions.pasteShapes(copied);

    expect(ordered().map((shape) => shape.type)).toEqual(['circle', 'rectangle']);
    expect(ordered().every((shape) => !shape.locked && !shape.parentShapeId)).toBe(true);
    expect(Object.values(document().groups)).toEqual([]);
});

it('cuts the selected shapes it can delete, and keeps locked ones', () => {
    const { store, document, ordered } = storeWith(shapes[0], shapes[2]);
    const [rectangle, circle] = document().shapesIds;

    store.actions.lockShape(rectangle);

    const cut = store.actions.cutSelection()!;

    expect(document().shapesIds).toEqual([rectangle]);

    store.actions.pasteShapes(cut);

    expect(ordered().map((shape) => shape.type)).toEqual(['rectangle', 'circle']);
    expect(ordered()[1]).not.toMatchObject({ id: circle });
    expect(ordered()[1]).toMatchObject({ position: { x: 50, y: 50 } });
});

it('copies and cuts nothing without a selection, and cuts nothing that is all locked', () => {
    const { store, document } = storeWith(shapes[0]);

    store.actions.lockShape(document().shapesIds[0]);

    expect(store.actions.cutSelection()).toBeNull();
    expect(document().shapesIds).toHaveLength(1);

    store.actions.unselectShapes();

    expect(store.actions.copySelection()).toBeNull();
});

it.each([
    ['text that is not shapes', 'hello'],
    ['another format', JSON.stringify({ format: 'other', shapes: [] })],
    [
        'an invalid shape',
        JSON.stringify({
            format: 'reactor/shapes',
            shapes: [{ type: 'circle', position: { x: 0, y: 0 }, radius: -1, name: 'c' }]
        })
    ],
    [
        'an unknown shape type',
        JSON.stringify({ format: 'reactor/shapes', shapes: [{ type: 'x' }] })
    ],
    ['no shapes', JSON.stringify({ format: 'reactor/shapes', shapes: [] })]
])('pastes nothing from %s', (_, text) => {
    const { store, document } = storeWith(shapes[0]);

    expect(store.actions.pasteShapes(text)).toBe(false);
    expect(document().shapesIds).toHaveLength(1);
    expect(document().shapes[document().shapesIds[0]].selected).toBe(true);
});

it('leaves the clipboard alone while typing, dragging or away from the designer', () => {
    const { store, document } = storeWith(shapes[0]);
    const copied = store.actions.copySelection()!;

    store.actions.events.startTyping();
    expect(store.actions.copySelection()).toBeNull();
    expect(store.actions.pasteShapes(copied)).toBe(false);
    store.actions.events.endTyping();

    store.actions.showDocuments();
    expect(store.actions.cutSelection()).toBeNull();
    expect(store.actions.pasteShapes(copied)).toBe(false);
    expect(document().shapesIds).toHaveLength(1);
});
