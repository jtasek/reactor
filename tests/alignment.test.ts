import { alignOffsets, spaceOffsets } from 'src/app/alignment';
import { registerCommand } from 'src/app/actions/startup';
import type { Box, ShapeInput } from 'src/app/types';
import * as commands from 'src/commands';
import { createTestStore } from './support/store';

// Commands are registered by application startup, which the test store skips.
Object.values(commands).forEach(registerCommand);

const box = (left: number, top: number, width: number, height: number): Box => ({
    topLeft: { x: left, y: top },
    bottomRight: { x: left + width, y: top + height },
    width,
    height
});

describe('aligning boxes', () => {
    const boxes = [box(10, 0, 20, 10), box(50, 30, 40, 20)];

    it.each([
        ['left', [0, -40]],
        ['right', [60, 0]],
        ['center', [30, -20]]
    ] as const)('to the %s moves them across only', (to, dxs) => {
        expect(alignOffsets(boxes, to)).toEqual(dxs.map((x) => ({ x, y: 0 })));
    });

    it.each([
        ['top', [0, -30]],
        ['bottom', [40, 0]],
        ['middle', [20, -15]]
    ] as const)('to the %s moves them up or down only', (to, dys) => {
        expect(alignOffsets(boxes, to)).toEqual(dys.map((y) => ({ x: 0, y })));
    });
});

describe('spacing boxes', () => {
    // Widths 10, 30 and 10; the outer ones stay, from 0 to 100.
    const boxes = [box(90, 0, 10, 10), box(0, 0, 10, 10), box(20, 0, 30, 10)];

    it('between them leaves equal gaps, the outermost staying', () => {
        // 100 wide, 50 of it boxes: gaps of 25, so the middle one goes to 35.
        expect(spaceOffsets(boxes, 'horizontal', 'between')).toEqual([
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 15, y: 0 }
        ]);
    });

    it('equally puts their centers at equal distances', () => {
        // Centers 95 and 5 stay; the middle one's 35 goes to 50.
        expect(spaceOffsets(boxes, 'horizontal', 'centers')).toEqual([
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 15, y: 0 }
        ]);
        expect(
            spaceOffsets(
                [box(0, 0, 10, 10), box(0, 10, 10, 30), box(0, 90, 10, 10)],
                'vertical',
                'centers'
            )
        ).toEqual([
            { x: 0, y: 0 },
            { x: 0, y: 25 },
            { x: 0, y: 0 }
        ]);
    });
});

describe('the alignment commands', () => {
    const square = (x: number, y = 0, size = 10): ShapeInput => ({
        type: 'rectangle',
        position: { x, y },
        size: { width: size, height: size },
        selected: false
    });

    function storeWith(...shapes: ShapeInput[]) {
        const { store } = createTestStore();

        shapes.forEach((shape) => store.actions.addShape(shape));

        const ids = [...store.state.currentDocument.shapesIds];
        const select = (...chosen: string[]) => {
            store.actions.unselectShapes();
            chosen.forEach((id) => store.actions.selectShape(id));
        };
        const run = (command: string) => store.actions.submitCommandLine(command);
        const positions = () =>
            ids.map((id) => {
                const shape = store.state.currentDocument.shapes[id];

                return shape.type === 'rectangle' ? shape.position : null;
            });

        return { store, ids, select, run, positions };
    }

    it('align the selected shapes, each by the box it is drawn in', () => {
        const { ids, select, run, positions } = storeWith(square(10, 0), square(50, 30, 20));

        select(...ids);
        expect(run('Align left')).toBeUndefined();
        expect(positions()).toEqual([
            { x: 10, y: 0 },
            { x: 10, y: 30 }
        ]);

        expect(run('align-bottom')).toBeUndefined();
        expect(positions()).toEqual([
            { x: 10, y: 40 },
            { x: 10, y: 30 }
        ]);
    });

    it('move a group selected as one whole, and leave locked shapes where they are', () => {
        const { store, ids, select, run, positions } = storeWith(
            square(0),
            square(20),
            square(100, 50),
            square(200, 80)
        );

        select(ids[0], ids[1]);
        run('group');
        store.actions.lockShape(ids[3]);
        select(...ids);
        expect(run('Align bottom')).toBeUndefined();

        // The group's box and the free square end on the same line; the locked one stays.
        expect(positions()).toEqual([
            { x: 0, y: 50 },
            { x: 20, y: 50 },
            { x: 100, y: 50 },
            { x: 200, y: 80 }
        ]);
    });

    it('take a turned shape by the box it is drawn in', () => {
        const { store, ids, select, run } = storeWith(square(0, 0, 100), {
            type: 'rectangle',
            position: { x: 300, y: 300 },
            size: { width: 100, height: 20 },
            selected: false
        });

        // A quarter turn draws the 100 by 20 bar 20 wide and 100 high about (350, 310).
        store.actions.rotateShape({ shapeId: ids[1], position: { x: 450, y: 310 } });
        select(...ids);
        run('Align top');

        const bar = store.state.currentDocument.shapes[ids[1]];

        expect(bar.type === 'rectangle' && bar.position.y).toBeCloseTo(40);
    });

    it('are not available without enough items they may move', () => {
        const { store, ids, select, run } = storeWith(square(0), square(20), square(40));
        const refused = (name: string) => `${name} is not available right now`;

        select(ids[0]);
        expect(run('Align left')).toBe(refused('Align left'));

        select(ids[0], ids[1]);
        expect(run('Space between horizontally')).toBe(refused('Space between horizontally'));

        store.actions.lockShape(ids[2]);
        select(...ids);
        expect(run('Space equally horizontally')).toBe(refused('Space equally horizontally'));
        expect(run('Align left')).toBeUndefined();
    });
});
