import type { Box, Camera, Point } from './types';

/** The menu's height and the width of its bar, in screen pixels. */
const MENU_HEIGHT = 26;
const MENU_WIDTH = 80;

const GAP = 10;
/** Above the rotate handle, which stands 24 pixels over the middle of the box's top. */
const GAP_OVER_ROTATE_HANDLE = 38;
/** How far around the box and the menu the pointer still counts as over them. */
const REACH = 6;

export type SelectionMenuPlacement = { left: number; shown: boolean } & (
    | { below: false; bottom: number }
    | { below: true; top: number }
);

/**
 * Where the selection's menu goes, in surface pixels: above the top left corner
 * of the selection's box, over the rotate handle when the menu would cover it,
 * or under the box without room above. It is shown while the pointer is over the
 * box, the menu or the way between them.
 */
export function placeSelectionMenu(
    extent: Box,
    camera: Camera,
    pointer: { current: Point; inside: boolean }
): SelectionMenuPlacement {
    const { scale, position } = camera;
    const left = extent.topLeft.x * scale + position.x;
    const right = extent.bottomRight.x * scale + position.x;
    const top = extent.topLeft.y * scale + position.y;
    const bottom = extent.bottomRight.y * scale + position.y;
    const coversRotateHandle = (right - left) / 2 < MENU_WIDTH + REACH;
    const gap = coversRotateHandle ? GAP_OVER_ROTATE_HANDLE : GAP;
    const below = top - gap - MENU_HEIGHT < 0;
    const x = pointer.current.x * scale + position.x;
    const y = pointer.current.y * scale + position.y;
    const shown =
        pointer.inside &&
        x >= left - REACH &&
        x <= Math.max(right, left + MENU_WIDTH) + REACH &&
        y >= (below ? top : top - gap - MENU_HEIGHT) - REACH &&
        y <= (below ? bottom + GAP + MENU_HEIGHT : bottom) + REACH;

    return below
        ? { left, shown, below, top: bottom + GAP }
        : { left, shown, below, bottom: top - gap };
}
