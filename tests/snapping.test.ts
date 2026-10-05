import { snapMove, snapTargets } from 'src/app/snapping';
import type { Box, ShapeInput } from 'src/app/types';
import { createTestStore } from './support/store';

const box = (left: number, top: number, width: number, height: number): Box => ({
    topLeft: { x: left, y: top },
    bottomRight: { x: left + width, y: top + height },
    width,
    height
});

describe('snapping a moved box', () => {
    // A target 100 to 200 across and down: lines at 100, 150 and 200 on each axis.
    const targets = snapTargets([box(100, 100, 100, 100)]);
    const moved = box(0, 0, 40, 40);

    it('pulls the nearest of its edges and center onto a line within reach', () => {
        // Left edge 97 is 3 short of 100; nothing on y is within 5.
        expect(snapMove(moved, { x: 97, y: 20 }, targets, 5)).toEqual({
            delta: { x: 100, y: 20 },
            lines: { x: 100, y: null }
        });
        // The left edge 156 is 6 past 150, but the right edge 196 is 4 short of 200,
        // which wins; the bottom 152 is 2 past 150.
        expect(snapMove(moved, { x: 156, y: 112 }, targets, 5)).toEqual({
            delta: { x: 160, y: 110 },
            lines: { x: 200, y: 150 }
        });
    });

    it('leaves the move as it is beyond reach', () => {
        expect(snapMove(moved, { x: 50, y: 50 }, targets, 5)).toEqual({
            delta: { x: 50, y: 50 },
            lines: { x: null, y: null }
        });
    });
});

describe('dragging shapes', () => {
    const square = (x: number, y: number): ShapeInput => ({
        type: 'rectangle',
        position: { x, y },
        size: { width: 40, height: 40 },
        selected: false
    });

    function twoSquares() {
        const { store } = createTestStore();

        store.actions.addShape(square(0, 0));
        store.actions.addShape(square(200, 100));

        const [moved] = store.state.currentDocument.shapesIds;
        const { events } = store.actions;
        const position = () => {
            const shape = store.state.currentDocument.shapes[moved];

            return shape.type === 'rectangle' ? shape.position : null;
        };

        return { store, events, position };
    }

    it('snaps the dragged shape to the other shapes and shows the line it snapped to', () => {
        const { store, events, position } = twoSquares();

        events.beginGesture({ pointerId: 1, position: { x: 20, y: 20 } });
        // Its left edge would be at 197, three short of the other's at 200.
        events.movePointer({ pointerId: 1, position: { x: 217, y: 50 } });

        expect(position()).toEqual({ x: 200, y: 30 });

        const { gesture } = store.state.events.pointer;

        expect(gesture.kind === 'moving' && gesture.snapLines).toEqual({ x: 200, y: null });

        events.endGesture({ pointerId: 1, position: { x: 217, y: 50 } });

        expect(position()).toEqual({ x: 200, y: 30 });
        expect(store.state.events.pointer.gesture.kind).toBe('idle');
    });

    it('moves freely while Ctrl or Cmd is held', () => {
        const { events, position } = twoSquares();

        events.beginGesture({ pointerId: 1, position: { x: 20, y: 20 } });
        events.movePointer({ pointerId: 1, position: { x: 217, y: 50 }, free: true });
        events.endGesture({ pointerId: 1, position: { x: 217, y: 50 }, free: true });

        expect(position()).toEqual({ x: 197, y: 30 });
    });

    it('reaches as far on the screen at any zoom', () => {
        const { store, events, position } = twoSquares();

        // At half size, 3 canvas units are 1.5 pixels and 9 are 4.5: both within reach.
        store.actions.tools.zoomToAnchor({
            scale: 0.5,
            anchor: { x: 0, y: 0 },
            point: { x: 0, y: 0 }
        });
        events.beginGesture({ pointerId: 1, position: { x: 20, y: 20 } });
        events.movePointer({ pointerId: 1, position: { x: 211, y: 50 } });

        expect(position()).toEqual({ x: 200, y: 30 });
    });
});
