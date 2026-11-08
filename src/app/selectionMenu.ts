import type { Box, Camera, Point } from './types';

/** The menu's height and the width of its bar, in screen pixels. */
const MENU_HEIGHT = 26;
const MENU_WIDTH = 80;

/** Clear the rotate handle, which can extend 24 pixels beyond any side of a turned box. */
const GAP = 38;
/** How far around the box and the menu the pointer still counts as over them. */
const REACH = 6;

export type SelectionMenuPlacement = { left: number; shown: boolean } & (
    | { below: false; bottom: number }
    | { below: true; top: number }
);

/**
 * Where the selection's menu goes, in surface pixels: above the top left corner
 * of the selection's box, clear of its handles regardless of the toolbar's width,
 * or under the box without room above. The pointer over the box shows it; once
 * shown, it stays while the pointer is on its way to the menu, but a pointer
 * coming there from elsewhere presses what is drawn under the menu.
 */
export function placeSelectionMenu(
    extent: Box,
    camera: Camera,
    pointer: { current: Point; inside: boolean },
    alreadyShown = false
): SelectionMenuPlacement {
    const { scale, position } = camera;
    const left = extent.topLeft.x * scale + position.x;
    const right = extent.bottomRight.x * scale + position.x;
    const top = extent.topLeft.y * scale + position.y;
    const bottom = extent.bottomRight.y * scale + position.y;
    const below = top - GAP - MENU_HEIGHT < 0;
    const x = pointer.current.x * scale + position.x;
    const y = pointer.current.y * scale + position.y;
    const within = (minX: number, maxX: number, minY: number, maxY: number) =>
        x >= minX - REACH && x <= maxX + REACH && y >= minY - REACH && y <= maxY + REACH;
    const overBox = within(left, right, top, bottom);
    const onWayToMenu = within(
        left,
        Math.max(right, left + MENU_WIDTH),
        below ? bottom : top - GAP - MENU_HEIGHT,
        below ? bottom + GAP + MENU_HEIGHT : top
    );
    const shown = pointer.inside && (overBox || (alreadyShown && onWayToMenu));

    return below
        ? { left, shown, below, top: bottom + GAP }
        : { left, shown, below, bottom: top - GAP };
}
