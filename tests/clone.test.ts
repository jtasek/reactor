import { cloneSelection } from 'src/commands/clone';
import type { ShapeInput } from 'src/app/types';
import { getShapeBounds } from 'src/app/utils';
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

function cloneOf(shape: ShapeInput) {
    const { store } = createTestStore();

    store.actions.addShape({ ...shape, name: 'Original', selected: true, rotation: 30 });

    const [originalId] = store.state.currentDocument.shapesIds;

    store.actions.executeCommand(cloneSelection);

    const cloneId = store.state.currentDocument.shapesIds.find((id) => id !== originalId)!;
    const get = (id: string) => store.state.currentDocument.shapes[id];

    return { store, original: () => get(originalId), clone: () => get(cloneId), cloneId };
}

describe.each(shapes)('cloning a $type', (shape) => {
    it('adds an independent copy offset by (10, 10) with fresh metadata', () => {
        const { original, clone, cloneId } = cloneOf(shape);
        const source = getShapeBounds(original());

        expect(getShapeBounds(clone())).toMatchObject({
            topLeft: { x: source.topLeft.x + 10, y: source.topLeft.y + 10 },
            width: source.width,
            height: source.height
        });
        expect(clone()).toMatchObject({
            type: shape.type,
            id: cloneId,
            key: `${shape.type}-${cloneId}`,
            name: 'Clone of Original',
            rotation: 30,
            selected: false,
            children: []
        });
    });

    it('does not follow later edits of the original', () => {
        const { store, original, clone } = cloneOf(shape);
        const before = getShapeBounds(clone());

        store.actions.moveSelectedShapes({ x: 100, y: 100 });

        expect(getShapeBounds(original()).topLeft.x).toBeGreaterThan(90);
        expect(getShapeBounds(clone())).toEqual(before);
    });
});

it('does not copy the measured bounds of the original', () => {
    const { store } = createTestStore();

    store.actions.addShape({ ...shapes[0], selected: true });

    const [id] = store.state.currentDocument.shapesIds;

    store.actions.setShapeBounds({
        id,
        bounds: { topLeft: { x: 9, y: 19 }, bottomRight: { x: 51, y: 51 }, width: 42, height: 32 }
    });
    store.actions.executeCommand(cloneSelection);

    const clone = Object.values(store.state.currentDocument.shapes).find(
        (shape) => shape.id !== id
    )!;

    expect(clone.bounds).toBeUndefined();
    expect(getShapeBounds(clone).topLeft).toEqual({ x: 20, y: 30 });
});
