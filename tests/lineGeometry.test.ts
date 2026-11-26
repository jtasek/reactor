import { ARROW_HEAD, arrowHeadPoints, snapToEighth } from 'src/app/lineGeometry';
import { createLineProps } from 'src/tools/components/Line';
import type { Pointer } from 'src/events/types';
import type { Shape } from 'src/app/types';
import { SHAPE_PROPERTIES, applyProperty } from 'src/app/properties';

describe('lines and arrows', () => {
    it('snap to the nearest 45° and keep their length', () => {
        expect(snapToEighth({ x: 0, y: 0 }, { x: 100, y: 8 })).toEqual({ x: 100, y: 0 });
        expect(snapToEighth({ x: 0, y: 0 }, { x: 60, y: 50 })).toEqual({ x: 55, y: 55 });
        expect(snapToEighth({ x: 10, y: 10 }, { x: 12, y: -90 })).toEqual({ x: 10, y: -90 });
    });

    it('point the arrowhead back along the line from its end', () => {
        const [left, tip, right] = arrowHeadPoints({ x: 0, y: 0 }, { x: 100, y: 0 });
        const along = ARROW_HEAD.length * Math.cos((ARROW_HEAD.angle * Math.PI) / 180);

        expect(tip).toEqual({ x: 100, y: 0 });
        expect(left.x).toBeCloseTo(100 - along);
        expect(right.x).toBeCloseTo(100 - along);
        expect(left.y).toBeCloseTo(-right.y);
    });

    it('are drawn snapped with Shift, and marked as arrows by the Arrow tool', () => {
        const pointer = { start: { x: 0, y: 0 }, current: { x: 100, y: 8 } } as Pointer;

        expect(createLineProps(pointer, { snap: true, arrow: true })).toMatchObject({
            type: 'line',
            end: { x: 100, y: 0 },
            arrow: true
        });
        expect(createLineProps(pointer)).not.toHaveProperty('arrow');
    });

    it('adds or removes an arrowhead from the Inspector, on lines only', () => {
        const end = SHAPE_PROPERTIES.find((property) => property.key === 'arrow')!;
        const line = { type: 'line' } as Shape;

        expect(end.read(line, undefined!)).toBe('none');
        applyProperty(end, line, 'arrow');
        expect(line).toMatchObject({ arrow: true });
        applyProperty(end, line, 'none');
        expect(line).not.toHaveProperty('arrow');
        expect(end.read({ type: 'rectangle' } as Shape, undefined!)).toBeUndefined();
    });
});
