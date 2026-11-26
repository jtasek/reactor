import { createSquareProps } from 'src/tools/components/Square';
import type { Pointer } from 'src/events/types';

const drag = (start: Pointer['start'], current: Pointer['current']) =>
    ({
        start,
        current,
        topLeft: { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y) },
        size: { width: Math.abs(current.x - start.x), height: Math.abs(current.y - start.y) }
    }) as Pointer;

describe('the square tool', () => {
    it('draws a rectangle with the drag’s longer side', () => {
        expect(createSquareProps(drag({ x: 10, y: 10 }, { x: 50, y: 30 }))).toMatchObject({
            type: 'rectangle',
            position: { x: 10, y: 10 },
            size: { width: 40, height: 40 }
        });
    });

    it('grows from where the drag started, toward the pointer', () => {
        expect(createSquareProps(drag({ x: 100, y: 100 }, { x: 80, y: 40 }))).toMatchObject({
            position: { x: 40, y: 40 },
            size: { width: 60, height: 60 }
        });
    });
});
