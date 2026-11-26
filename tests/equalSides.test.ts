import { withEqualSides } from 'src/tools/equalSides';
import type { Pointer } from 'src/events/types';

const drag = (start: Pointer['start'], current: Pointer['current']) =>
    ({
        start,
        current,
        topLeft: { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y) },
        size: { width: Math.abs(current.x - start.x), height: Math.abs(current.y - start.y) }
    }) as Pointer;

describe('a drag with equal sides', () => {
    it('takes the longer side', () => {
        expect(withEqualSides(drag({ x: 10, y: 10 }, { x: 50, y: 30 }))).toMatchObject({
            topLeft: { x: 10, y: 10 },
            size: { width: 40, height: 40 },
            center: { x: 30, y: 30 }
        });
    });

    it('grows from where the drag started, toward the pointer', () => {
        expect(withEqualSides(drag({ x: 100, y: 100 }, { x: 80, y: 40 }))).toMatchObject({
            topLeft: { x: 40, y: 40 },
            size: { width: 60, height: 60 }
        });
    });
});
