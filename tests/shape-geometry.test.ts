import { json } from 'overmind';
import { resizeCursor } from 'src/app/geometry';
import type { Box, Point, Shape } from 'src/app/types';
import { boxCenter, getBoundingBox, getShapeBounds, rotatePoint } from 'src/app/utils';
import { createTestStore } from './support/store';

/**
 * Characterizes how every shape type moves, resizes and rotates, so the shape
 * model can be refactored without changing geometry. Each case adds one shape,
 * then applies a move of (5, -5), a bottom-right resize to `resizeTo`, or a
 * rotation towards a point directly right of the shape's center.
 */
const cases = [
    {
        name: 'rectangle',
        shape: {
            type: 'rectangle' as const,
            position: { x: 10, y: 20 },
            size: { width: 40, height: 30 }
        },
        bounds: { topLeft: { x: 10, y: 20 }, bottomRight: { x: 50, y: 50 } },
        moved: { position: { x: 15, y: 15 } },
        resizeTo: { x: 70, y: 60 },
        resized: { position: { x: 10, y: 20 }, size: { width: 60, height: 40 } }
    },
    {
        name: 'image',
        shape: {
            type: 'image' as const,
            position: { x: 10, y: 20 },
            size: { width: 40, height: 20 },
            source: 'image.png'
        },
        bounds: { topLeft: { x: 10, y: 20 }, bottomRight: { x: 50, y: 40 } },
        moved: { position: { x: 15, y: 15 } },
        // Images keep their aspect ratio (2:1): the dominant width wins.
        resizeTo: { x: 90, y: 50 },
        resized: { position: { x: 10, y: 20 }, size: { width: 80, height: 40 } }
    },
    {
        name: 'circle',
        shape: { type: 'circle' as const, position: { x: 50, y: 50 }, radius: 10 },
        bounds: { topLeft: { x: 40, y: 40 }, bottomRight: { x: 60, y: 60 } },
        moved: { position: { x: 55, y: 45 } },
        // Circles stay round: the dominant axis sets the diameter.
        resizeTo: { x: 80, y: 70 },
        resized: { position: { x: 60, y: 60 }, radius: 20 }
    },
    {
        name: 'ellipse',
        shape: {
            type: 'ellipse' as const,
            position: { x: 50, y: 50 },
            radius: { x: 20, y: 10 }
        },
        bounds: { topLeft: { x: 30, y: 40 }, bottomRight: { x: 70, y: 60 } },
        moved: { position: { x: 55, y: 45 } },
        resizeTo: { x: 90, y: 80 },
        resized: { position: { x: 60, y: 60 }, radius: { x: 30, y: 20 } }
    },
    {
        name: 'line',
        shape: { type: 'line' as const, start: { x: 0, y: 0 }, end: { x: 40, y: 30 } },
        bounds: { topLeft: { x: 0, y: 0 }, bottomRight: { x: 40, y: 30 } },
        moved: { start: { x: 5, y: -5 }, end: { x: 45, y: 25 } },
        resizeTo: { x: 80, y: 60 },
        resized: { start: { x: 0, y: 0 }, end: { x: 80, y: 60 } }
    },
    {
        name: 'pen',
        shape: {
            type: 'pen' as const,
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 20 },
                { x: 40, y: 30 }
            ]
        },
        bounds: { topLeft: { x: 0, y: 0 }, bottomRight: { x: 40, y: 30 } },
        moved: {
            points: [
                { x: 5, y: -5 },
                { x: 15, y: 15 },
                { x: 45, y: 25 }
            ]
        },
        resizeTo: { x: 80, y: 60 },
        resized: {
            points: [
                { x: 0, y: 0 },
                { x: 20, y: 40 },
                { x: 80, y: 60 }
            ]
        }
    },
    {
        name: 'text',
        shape: { type: 'text' as const, position: { x: 10, y: 40 }, value: 'abc', fontSize: 20 },
        // Estimated from the font size: 0.6em per character, ascent 0.8em.
        bounds: { topLeft: { x: 10, y: 24 }, bottomRight: { x: 46, y: 44 } },
        moved: { position: { x: 15, y: 35 } },
        // Text scales its font with the box, whose top-left corner stays put, so its
        // baseline moves down with the larger ascent.
        resizeTo: { x: 82, y: 64 },
        resized: { position: { x: 10, y: 56 }, fontSize: 40 }
    }
];

function storeWith(shape: (typeof cases)[number]['shape']) {
    const { store } = createTestStore();

    store.actions.addShape({ ...shape, selected: true });

    const [id] = store.state.currentDocument.shapesIds;

    return { store, id, shape: () => store.state.currentDocument.shapes[id] };
}

describe.each(cases)('$name geometry', ({ shape, bounds, moved, resizeTo, resized }) => {
    it('computes analytic bounds', () => {
        const { shape: current } = storeWith(shape);

        expect(getShapeBounds(current())).toMatchObject(bounds);
    });

    it('moves by a delta', () => {
        const { store, shape: current } = storeWith(shape);

        store.actions.moveSelectedShapes({ x: 5, y: -5 });

        expect(current()).toMatchObject(moved);
    });

    it('resizes from the bottom-right handle', () => {
        const { store, id, shape: current } = storeWith(shape);

        store.actions.resizeShape({ shapeId: id, handlerType: 'bottomRight', position: resizeTo });

        expect(current()).toMatchObject(resized);
    });

    it('rotates towards the pointer around its center', () => {
        const { store, id, shape: current } = storeWith(shape);
        const box = getShapeBounds(current());
        const center = {
            x: box.topLeft.x + box.width / 2,
            y: box.topLeft.y + box.height / 2
        };

        store.actions.rotateShape({ shapeId: id, position: { x: center.x + 100, y: center.y } });

        expect(current().rotation).toBe(90);
    });
});

/** Where a point of a shape's unrotated box is drawn, rotated about the box center. */
function drawn(shape: Shape, point: (box: Box) => Point) {
    const box = getShapeBounds(shape);

    return rotatePoint(point(box), boxCenter(box), shape.rotation ?? 0);
}

function rectangle(shape: Shape) {
    if (shape.type !== 'rectangle') {
        throw new Error(`Expected a rectangle, not a ${shape.type}`);
    }

    return shape;
}

const topLeft = (box: Box) => box.topLeft;
const bottomRight = (box: Box) => box.bottomRight;

it('resizes a rotated shape so the handle follows the pointer and the opposite one stays', () => {
    const { store, id, shape: current } = storeWith(cases[0].shape);

    store.actions.updateShape({ id, rotation: 90 });

    const anchor = drawn(current(), topLeft);
    // Where the bottom-right corner of a 60 by 40 box would be drawn.
    const pointer = { x: 5, y: 75 };

    store.actions.resizeShape({ shapeId: id, handlerType: 'bottomRight', position: pointer });

    expect(rectangle(current()).size).toEqual({
        width: expect.closeTo(60),
        height: expect.closeTo(40)
    });
    expect(drawn(current(), topLeft)).toEqual({
        x: expect.closeTo(anchor.x),
        y: expect.closeTo(anchor.y)
    });
    expect(drawn(current(), bottomRight)).toEqual({
        x: expect.closeTo(pointer.x),
        y: expect.closeTo(pointer.y)
    });
});

it('keeps a rotated flat line in place, as it is drawn once measured', () => {
    const {
        store,
        id,
        shape: current
    } = storeWith({
        type: 'line',
        start: { x: 0, y: 0 },
        end: { x: 40, y: 0 }
    });

    store.actions.updateShape({ id, rotation: 45 });

    const anchor = drawn(current(), topLeft);

    store.actions.resizeShape({
        shapeId: id,
        handlerType: 'bottomRight',
        position: rotatePoint({ x: 60, y: 20 }, { x: 20, y: 0 }, 45)
    });

    // Measured bounds of a flat line have no height.
    const measured = getBoundingBox(current());

    expect(measured.height).toBe(0);
    expect(rotatePoint(measured.topLeft, boxCenter(measured), 45)).toEqual({
        x: expect.closeTo(anchor.x),
        y: expect.closeTo(anchor.y)
    });
});

it('widens a rectangle that has no width', () => {
    const {
        store,
        id,
        shape: current
    } = storeWith({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 0, height: 30 }
    });

    store.actions.resizeShape({
        shapeId: id,
        handlerType: 'middleRight',
        position: { x: 40, y: 35 }
    });

    expect(current()).toMatchObject({
        position: { x: 10, y: 20 },
        size: { width: 30, height: 30 }
    });
});

it('resizes from where the drag began, so steps between measurements do not add up', () => {
    const { store, id, shape: current } = storeWith(cases[0].shape);

    store.actions.updateShape({ id, rotation: 30 });

    const original = rectangle(json(current()));

    for (const position of [
        { x: 60, y: 70 },
        { x: 75, y: 80 },
        { x: 90, y: 95 }
    ]) {
        store.actions.resizeShape({ shapeId: id, handlerType: 'bottomRight', position, original });
    }

    const stepped = rectangle(json(current()));

    store.actions.updateShape({ id, position: original.position, size: original.size });
    store.actions.resizeShape({
        shapeId: id,
        handlerType: 'bottomRight',
        position: { x: 90, y: 95 },
        original
    });

    expect(current()).toMatchObject({ position: stepped.position, size: stepped.size });
});

it('points each resize cursor the way its handle points on screen', () => {
    expect(resizeCursor('topLeft')).toBe('nwse-resize');
    expect(resizeCursor('topRight')).toBe('nesw-resize');
    expect(resizeCursor('middleTop')).toBe('ns-resize');
    expect(resizeCursor('middleLeft')).toBe('ew-resize');

    expect(resizeCursor('middleTop', 90)).toBe('ew-resize');
    expect(resizeCursor('topLeft', 90)).toBe('nesw-resize');
    expect(resizeCursor('middleRight', 45)).toBe('nwse-resize');
    expect(resizeCursor('middleRight', -45)).toBe('nesw-resize');
});
