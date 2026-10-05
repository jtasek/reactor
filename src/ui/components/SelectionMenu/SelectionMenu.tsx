import React, { FC, memo, useEffect, useRef } from 'react';
import type { Command } from 'src/app/types';
import {
    useActions,
    useCommandEnabled,
    useSelectionCommands,
    useSelectionMenuPlacement
} from 'src/app/hooks';
import { HideCommand, LockCommand, UnlockCommand } from 'src/commands';
import { commandAction } from '../ItemMenu';
import { CanvasMenu } from './CanvasMenu';

const useCommandAction = (command: Command) => {
    const { runCommand } = useActions();
    const enabled = useCommandEnabled(command);

    return commandAction(command, () => runCommand(command), !enabled);
};

interface Props {
    /** Whether a locked item's menu is shown instead. */
    stepAside: boolean;
}

/**
 * The menu of the selected shapes, over the canvas at a size the zoom does not
 * change. It fades in while the pointer is over the selection and is gone
 * during a drag.
 */
export const SelectionMenu: FC<Props> = memo(({ stepAside }) => {
    const shownBefore = useRef(false);
    const placement = useSelectionMenuPlacement(shownBefore.current);
    const hide = useCommandAction(HideCommand);
    const lock = useCommandAction(LockCommand);
    const unlock = useCommandAction(UnlockCommand);
    const { runCommand } = useActions();
    const commands = useSelectionCommands().map((command) =>
        commandAction(command, () => runCommand(command))
    );

    useEffect(() => {
        shownBefore.current = placement?.shown ?? false;
    });

    if (!placement) {
        return null;
    }

    const lockOrUnlock = unlock.disabled ? lock : { ...unlock, pressed: true };

    return (
        <CanvasMenu
            placement={placement}
            shown={placement.shown && !stepAside}
            itemName="Selection"
            actions={[hide, lockOrUnlock, ...commands]}
        />
    );
});

SelectionMenu.displayName = 'SelectionMenu';
