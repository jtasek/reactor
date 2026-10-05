import React, { FC, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Command } from 'src/app/types';
import { useActions, useCommandEnabled, useSelectionMenuPlacement } from 'src/app/hooks';
import {
    BringToFrontCommand,
    CloneCommand,
    DeleteCommand,
    GroupCommand,
    HideCommand,
    LockCommand,
    SendToBackCommand,
    UngroupCommand,
    UnlockCommand
} from 'src/commands';
import { ItemMenu, commandAction } from '../ItemMenu';
import styles from './styles.css';

const WINDOW_MARGIN = 4;

const useCommandAction = (command: Command) => {
    const { runCommand } = useActions();
    const enabled = useCommandEnabled(command);

    return commandAction(command, () => runCommand(command), !enabled);
};

/**
 * The menu of the selected shapes, over the canvas at a size the zoom does not
 * change. It fades in while the pointer is over the selection and is gone
 * during a drag.
 */
export const SelectionMenu: FC = () => {
    const shownBefore = useRef(false);
    const placement = useSelectionMenuPlacement(shownBefore.current);
    const hide = useCommandAction(HideCommand);
    const lock = useCommandAction(LockCommand);
    const unlock = useCommandAction(UnlockCommand);
    const group = useCommandAction(GroupCommand);
    const ungroup = useCommandAction(UngroupCommand);
    const others = [
        useCommandAction(CloneCommand),
        useCommandAction(DeleteCommand),
        useCommandAction(BringToFrontCommand),
        useCommandAction(SendToBackCommand)
    ];

    useEffect(() => {
        shownBefore.current = placement?.shown ?? false;
    });

    // The menu is kept inside the window, as wide as it is with its buttons shown.
    const host = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const placed = placement !== null;

    useLayoutEffect(() => {
        const node = host.current;

        if (!node) {
            return;
        }

        const observer = new ResizeObserver(() => setWidth(node.offsetWidth));

        observer.observe(node);

        return () => observer.disconnect();
    }, [placed]);

    if (!placement) {
        return null;
    }

    const { shown } = placement;
    const left = Math.max(0, Math.min(placement.left, window.innerWidth - width - WINDOW_MARGIN));
    const lockOrUnlock = unlock.disabled ? lock : { ...unlock, pressed: true };

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
            <ItemMenu
                itemName="Selection"
                actions={[
                    hide,
                    lockOrUnlock,
                    ...others,
                    ...[group, ungroup].filter(({ disabled }) => !disabled)
                ]}
            />
        </div>
    );
};
