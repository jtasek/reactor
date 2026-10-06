import { snapDistances, snapMove, targetLines } from 'src/app/snapping';
import type { Box } from 'src/app/types';

const box = (left: number, top: number, width: number, height: number): Box => ({
    topLeft: { x: left, y: top },
    bottomRight: { x: left + width, y: top + height },
    width,
    height
});

const REACH = 5;

describe('the distance on a snapped line', () => {
    // One square above where the box goes, and one far to its right on its top line.
    const targets = targetLines([box(100, 0, 40, 40), box(300, 100, 40, 40)]);

    it('is the gap to the nearest other shape on each line it snapped to', () => {
        expect(snapDistances({ x: 100, y: 100 }, box(100, 100, 40, 40), targets)).toEqual([
            { axis: 'y', from: { x: 100, y: 40 }, to: { x: 100, y: 100 } },
            { axis: 'x', from: { x: 140, y: 100 }, to: { x: 300, y: 100 } }
        ]);
    });

    it('is none without a line, or with no other shape apart on it', () => {
        expect(snapDistances({ x: null, y: null }, box(100, 100, 40, 40), targets)).toEqual([]);
        // On the line of the square above, but overlapping it.
        expect(snapDistances({ x: 100, y: null }, box(100, 20, 40, 40), targets)).toEqual([]);
    });
});

describe('equal gaps', () => {
    it('extends a row by the gap already in it, and marks the equal gaps', () => {
        // Squares at 0 and 60 across, 20 apart; the box would end 17 after the second.
        const targets = targetLines([box(0, 0, 40, 40), box(60, 0, 40, 40)]);
        const moved = snapMove(box(0, 200, 40, 40), { x: 117, y: -195 }, targets, REACH);

        expect(moved.delta.x).toBe(120);
        expect(moved.lines.x).toBeNull();
        expect(moved.gaps).toEqual([
            { axis: 'x', from: { x: 40, y: 20 }, to: { x: 60, y: 20 } },
            { axis: 'x', from: { x: 100, y: 20 }, to: { x: 120, y: 20 } }
        ]);
    });

    it('puts the box midway between its neighbors', () => {
        const targets = targetLines([box(0, 0, 40, 40), box(140, 0, 40, 40)]);
        const moved = snapMove(box(0, 0, 40, 40), { x: 72, y: 0 }, targets, REACH);

        expect(moved.delta.x).toBe(70);
        expect(moved.gaps).toEqual([
            { axis: 'x', from: { x: 40, y: 20 }, to: { x: 70, y: 20 } },
            { axis: 'x', from: { x: 110, y: 20 }, to: { x: 140, y: 20 } }
        ]);
    });

    it('spaces a column the same way, down', () => {
        const targets = targetLines([box(0, 0, 40, 40), box(0, 60, 40, 40)]);
        const moved = snapMove(box(200, 0, 40, 40), { x: -200, y: 118 }, targets, REACH);

        expect(moved.delta.y).toBe(120);
        expect(moved.gaps.map((gap) => gap.axis)).toEqual(['y', 'y']);
    });

    it('gives way to a nearer edge, and takes no shape outside the row', () => {
        const targets = targetLines([box(0, 0, 40, 40), box(60, 0, 40, 40)]);

        // The left edge 99 is 1 from the second square's right edge at 100.
        expect(snapMove(box(0, 0, 40, 40), { x: 99, y: 0 }, targets, REACH)).toMatchObject({
            delta: { x: 100 },
            gaps: []
        });
        // Far below the row, the gap between the squares does not count.
        expect(snapMove(box(0, 300, 40, 40), { x: 117, y: 0 }, targets, REACH).gaps).toEqual([]);
    });
});
