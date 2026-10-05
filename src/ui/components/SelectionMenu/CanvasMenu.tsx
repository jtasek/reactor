import React, { FC, useLayoutEffect, useRef, useState } from 'react';
import type { SelectionMenuPlacement } from 'src/app/selectionMenu';
import { ItemMenu, ItemMenuAction } from '../ItemMenu';
import styles from './styles.css';

const WINDOW_MARGIN = 4;

interface Props {
    placement: SelectionMenuPlacement;
    /** Whether it is faded in; the pointer over it, or the focus in it, also shows it. */
    shown: boolean;
    itemName: string;
    actions: ItemMenuAction[];
}

/** A menu over the canvas, where `placeSelectionMenu` puts it, at a size the zoom does not change. */
export const CanvasMenu: FC<Props> = ({ placement, shown, itemName, actions }) => {
    // The menu is kept inside the window, as wide as it is with its buttons shown.
    const host = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useLayoutEffect(() => {
        const node = host.current;

        if (!node) {
            return;
        }

        const observer = new ResizeObserver(() => setWidth(node.offsetWidth));

        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    const left = Math.max(0, Math.min(placement.left, window.innerWidth - width - WINDOW_MARGIN));

    return (
        <div
            ref={host}
            className={styles.selectionMenu}
            data-shown={shown}
            style={
                placement.below
                    ? { left, top: placement.top }
                    : { left, top: placement.bottom, transform: 'translateY(-100%)' }
            }
        >
            <ItemMenu itemName={itemName} actions={actions} />
        </div>
    );
};
