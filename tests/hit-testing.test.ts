import type { ShapeInput } from 'src/app/types';
import { createTestStore } from './support/store';

function setup(shape: ShapeInput) {
    const { store } = createTestStore();

    store.actions.addShape({ ...shape, selected: false });

    const [id] = store.state.currentDocument.shapesIds;
    const pressAt = (x: number, y: number) => {
        store.actions.events.setCurrentPosition({ x, y });

        return store.actions.selectShapeAtPointer();
    };
    const marquee = (from: { x: number; y: number }, to: { x: number; y: number }) => {
        store.actions.events.setStartPosition(from);
        store.actions.events.setCurrentPosition(to);
        store.actions.selectShapes();

        return store.state.currentDocument.shapes[id].selected;
    };

    return { store, id, pressAt, marquee };
}

// A 100×20 rectangle at (100, 100) rotated 90° about its center (150, 110) is
// drawn over x 140–160, y 60–160.
const rotated: ShapeInput = {
    type: 'rectangle',
    position: { x: 100, y: 100 },
    size: { width: 100, height: 20 },
    rotation: 90
};

describe('pressing shapes where they are drawn', () => {
    it('hits a rotated shape at its rendered location only', () => {
        const { pressAt } = setup(rotated);

        expect(pressAt(150, 150)).toBe(true);
        expect(pressAt(190, 110)).toBe(false);
    });

    it('hits circles and ellipses inside their outline, not their bounding box corners', () => {
        const circle = setup({ type: 'circle', position: { x: 50, y: 50 }, radius: 50 });

        expect(circle.pressAt(50, 95)).toBe(true);
        expect(circle.pressAt(8, 8)).toBe(false);

        const ellipse = setup({
            type: 'ellipse',
            position: { x: 100, y: 50 },
            radius: { x: 100, y: 50 }
        });

        expect(ellipse.pressAt(190, 50)).toBe(true);
        expect(ellipse.pressAt(15, 10)).toBe(false);
    });

    it('hits unselected lines and pens only near their stroke, then selected ones in their box', () => {
        // (90, 10) and (50, 50) miss the strokes but lie inside their boxes.
        const line = setup({ type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 100 } });

        expect(line.pressAt(90, 10)).toBe(false);
        // The stroke press selects the line, so its box now hits too.
        expect(line.pressAt(50, 53)).toBe(true);
        expect(line.pressAt(90, 10)).toBe(true);

        const pen = setup({
            type: 'pen',
            points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 }
            ]
        });

        expect(pen.pressAt(50, 50)).toBe(false);
        expect(pen.pressAt(98, 60)).toBe(true);
        expect(pen.pressAt(50, 50)).toBe(true);
    });

    it('presses a shape drawn inside a selected line’s box, even under the line', () => {
        const { store, pressAt } = setup({
            type: 'rectangle',
            position: { x: 60, y: 10 },
            size: { width: 20, height: 20 }
        });
        store.actions.addShape({
            type: 'line',
            start: { x: 0, y: 0 },
            end: { x: 100, y: 100 },
            selected: false
        });
        const [rectId, lineId] = store.state.currentDocument.shapesIds;
        store.actions.selectShape(lineId);

        expect(pressAt(70, 20)).toBe(true);
        expect(store.state.currentDocument.shapes[rectId].selected).toBe(true);
        expect(store.state.currentDocument.shapes[lineId].selected).toBe(false);
    });

    it('keeps the stroke tolerance constant on screen as the camera zooms', () => {
        const { store, pressAt } = setup({
            type: 'line',
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 }
        });

        // 4 screen pixels of slop plus half the 2-unit stroke: 5 units at scale 1.
        expect(pressAt(50, 5)).toBe(true);
        expect(pressAt(50, 6)).toBe(false);

        store.actions.tools.zoom({ scale: 4 });

        expect(pressAt(50, 2)).toBe(true);
        expect(pressAt(50, 3)).toBe(false);
    });
});

describe('clicking empty canvas', () => {
    it('keeps a selected line draggable by its box but marquees only its stroke', () => {
        const { store, id, pressAt, marquee } = setup({
            type: 'line',
            start: { x: 0, y: 0 },
            end: { x: 100, y: 100 }
        });

        store.actions.selectShape(id);

        // (90, 10) misses the stroke but lies inside the line's bounding box.
        expect(pressAt(90, 10)).toBe(true);
        expect(marquee({ x: 90, y: 10 }, { x: 90, y: 10 })).toBe(false);
    });
});

describe('marquee selection of rotated shapes', () => {
    it('selects a rotated shape by its drawn outline', () => {
        const { marquee } = setup(rotated);

        // Only overlaps the unrotated bounds (x 100–200, y 100–120).
        expect(marquee({ x: 180, y: 100 }, { x: 200, y: 120 })).toBe(false);
        // Only overlaps the rotated outline (x 140–160, y 60–160).
        expect(marquee({ x: 140, y: 60 }, { x: 160, y: 80 })).toBe(true);
    });
});
