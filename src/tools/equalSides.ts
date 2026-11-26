import type { Pointer } from 'src/events/types';

/** The drag made square, as Shift does: its longer side, grown from where it started. */
export function withEqualSides(pointer: Pointer): Pointer {
    const { start, current, size } = pointer;
    const side = Math.max(size.width, size.height);
    const topLeft = {
        x: current.x < start.x ? start.x - side : start.x,
        y: current.y < start.y ? start.y - side : start.y
    };

    return {
        ...pointer,
        topLeft,
        size: { width: side, height: side },
        center: { x: topLeft.x + side / 2, y: topLeft.y + side / 2 }
    };
}

/** The drag the shape tools draw from: made square while Shift is held. */
export const drawnDrag = (pointer: Pointer, shiftKey: boolean) =>
    shiftKey ? withEqualSides(pointer) : pointer;
