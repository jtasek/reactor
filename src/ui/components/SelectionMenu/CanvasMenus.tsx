import React, { FC, useEffect, useRef, useState } from 'react';
import type { CanvasItem } from 'src/app/membership';
import { useHoveredLockedItem, useLockedItemMenuPlacement } from 'src/app/hooks';
import { LockedItemMenu } from './LockedItemMenu';
import { SelectionMenu } from './SelectionMenu';

const sameItem = (a: CanvasItem | null, b: CanvasItem | null) =>
    a?.kind === b?.kind && a?.id === b?.id;

/**
 * The menus over the canvas: the selection's, and the menu of the locked item
 * under the pointer, which fades in over it and stays while the pointer goes to
 * it or the menu is in use. The selection's menu steps aside while it shows.
 */
export const CanvasMenus: FC = () => {
    const hovered = useHoveredLockedItem();
    const [item, setItem] = useState<CanvasItem | null>(null);
    const [engaged, setEngaged] = useState(false);
    const shownBefore = useRef(false);

    if (hovered && !sameItem(hovered, item)) {
        setItem(hovered);
    }

    const placement = useLockedItemMenuPlacement(item, shownBefore.current);
    const lockedMenuShown =
        hovered !== null || (placement !== null && (placement.shown || engaged));

    // Neither shown nor in use, or no longer locked, the menu goes, out of the keyboard's reach.
    if (item && !lockedMenuShown) {
        setItem(null);
        setEngaged(false);
    }

    useEffect(() => {
        shownBefore.current = placement?.shown ?? false;
    });

    return (
        <>
            <SelectionMenu stepAside={lockedMenuShown} />
            {item && placement && (
                <LockedItemMenu item={item} placement={placement} onEngagedChange={setEngaged} />
            )}
        </>
    );
};
