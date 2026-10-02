import React, { FC } from 'react';
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
    const placement = useSelectionMenuPlacement();
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

    if (!placement) {
        return null;
    }

    const { left, shown } = placement;
    const lockOrUnlock = unlock.disabled ? lock : { ...unlock, pressed: true };

    return (
        <div
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
                actions={[hide, lockOrUnlock]}
                moreActions={[...others, ...[group, ungroup].filter(({ disabled }) => !disabled)]}
                moreAbove={!placement.below}
                moreFromStart
            />
        </div>
    );
};
