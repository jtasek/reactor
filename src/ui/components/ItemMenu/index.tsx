import React, { FC, useLayoutEffect, useRef, useState } from 'react';
import { useActions } from 'src/app/hooks';
import type { Command, Icon as IconType } from 'src/app/types';
import { Icon } from '../Icon';
import styles from './styles.css';

export interface ItemMenuAction {
    id: string;
    label: string;
    icon: IconType;
    pressed?: boolean;
    disabled?: boolean;
    onRun: () => void;
}

const ICON_SIZE = 16;

export const commandAction = (
    command: Command,
    onRun: () => void,
    disabled = false
): ItemMenuAction => ({
    id: command.id,
    label: command.name,
    icon: { group: 'action', name: 'help', ...command.icon, size: ICON_SIZE },
    disabled,
    onRun
});

export const toggleAction = (
    id: string,
    pressed: boolean,
    { on, off }: Record<'on' | 'off', { label: string; group?: string; icon: string }>,
    onRun: () => void
): ItemMenuAction => {
    const { label, group = 'action', icon } = pressed ? on : off;

    return { id, label, icon: { group, name: icon, size: ICON_SIZE }, pressed, onRun };
};

/** Hides an item, or shows it again. */
export const hideAction = (isHidden: boolean, onRun: () => void) =>
    toggleAction(
        'hide',
        isHidden,
        {
            on: { label: 'Show', icon: 'visibility_off' },
            off: { label: 'Hide', icon: 'visibility' }
        },
        onRun
    );

/** Locks an item, or unlocks it. */
export const lockAction = (isLocked: boolean, onRun: () => void) =>
    toggleAction(
        'lock',
        isLocked,
        {
            on: { label: 'Unlock', icon: 'lock_outline' },
            off: { label: 'Lock', icon: 'lock_open' }
        },
        onRun
    );

/** Turns commands into an item's actions, which run each for the item's `shapeIds`. */
export const useItemCommandActions = (shapeIds: string[], disabled: boolean) => {
    const { runCommandOn } = useActions();

    return (commands: Command[]) =>
        commands.map((command) =>
            commandAction(
                command,
                () => runCommandOn({ shapeIds, commandId: command.id }),
                disabled
            )
        );
};

interface Props {
    itemName: string;
    /** Most used first: the first `SHOWN_BUTTONS` are in the bar, the rest behind More. */
    actions: ItemMenuAction[];
}

const SHOWN_BUTTONS = 7;

const MORE_ICON = { group: 'navigation', name: 'chevron_right', size: ICON_SIZE };

const MenuButton: FC<{ action: ItemMenuAction }> = ({
    action: { label, icon, pressed, disabled, onRun }
}) => (
    <button
        type="button"
        className={styles.button}
        title={label}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onRun}
    >
        <Icon icon={icon} />
    </button>
);

/**
 * Inside an element marked `data-menu-host`, the menu fades in while the pointer
 * is over that element or the keyboard's focus is in it; pressed buttons stay shown.
 * Its More button reveals the rest in its own place, until the pointer or the focus
 * leaves the menu.
 */
export const ItemMenu: FC<Props> = ({ itemName, actions }) => {
    const [revealed, setRevealed] = useState(false);
    const menu = useRef<HTMLDivElement>(null);
    const more = useRef<HTMLButtonElement>(null);
    const shownActions = actions.slice(0, SHOWN_BUTTONS);
    const moreActions = actions.slice(SHOWN_BUTTONS);

    useLayoutEffect(() => {
        if (!revealed) {
            return;
        }

        // Focus goes on from the More button, which is gone, to what it revealed,
        // or to the bar's last button that may be pressed when none of that may.
        const enabled = [...(menu.current?.querySelectorAll('button') ?? [])]
            .map((button, index) => ({ button, revealed: index >= shownActions.length }))
            .filter(({ button }) => !button.disabled);
        const target = (enabled.find(({ revealed }) => revealed) ?? enabled.at(-1))?.button;

        target?.focus();
    }, [revealed, shownActions.length]);

    return (
        <div
            ref={menu}
            className={styles.menu}
            role="toolbar"
            aria-label={`${itemName} menu`}
            onMouseLeave={() => setRevealed(false)}
            onBlur={(event) => {
                // Losing the More button itself is not leaving the menu.
                if (
                    !more.current?.contains(event.target) &&
                    !event.currentTarget.contains(event.relatedTarget)
                ) {
                    setRevealed(false);
                }
            }}
        >
            {shownActions.map((action) => (
                <MenuButton key={action.id} action={action} />
            ))}
            {revealed
                ? moreActions.map((action) => <MenuButton key={action.id} action={action} />)
                : moreActions.length > 0 && (
                      <button
                          ref={more}
                          type="button"
                          className={styles.button}
                          title="More"
                          aria-label="More"
                          aria-expanded={false}
                          onClick={() => setRevealed(true)}
                      >
                          <Icon icon={MORE_ICON} />
                      </button>
                  )}
        </div>
    );
};
