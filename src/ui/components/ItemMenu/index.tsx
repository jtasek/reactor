import React, { FC, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleHelp, Eye, EyeOff, Lock, LockOpen } from 'lucide-react';
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
    icon: { component: CircleHelp, ...command.icon, size: ICON_SIZE },
    disabled,
    onRun
});

export const toggleAction = (
    id: string,
    pressed: boolean,
    { on, off }: Record<'on' | 'off', { label: string } & Pick<IconType, 'component' | 'fill'>>,
    onRun: () => void
): ItemMenuAction => {
    const { label, component, fill } = pressed ? on : off;

    return { id, label, icon: { component, fill, size: ICON_SIZE }, pressed, onRun };
};

/** Hides an item, or shows it again. */
export const hideAction = (isHidden: boolean, onRun: () => void) =>
    toggleAction(
        'hide',
        isHidden,
        {
            on: { label: 'Show', component: EyeOff },
            off: { label: 'Hide', component: Eye }
        },
        onRun
    );

/** Locks an item, or unlocks it. */
export const lockAction = (isLocked: boolean, onRun: () => void) =>
    toggleAction(
        'lock',
        isLocked,
        {
            on: { label: 'Unlock', component: Lock },
            off: { label: 'Lock', component: LockOpen }
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
    /** Most used first: the rest are behind More. Compact menus swap pages inside a row. */
    actions: ItemMenuAction[];
    compact?: boolean;
    onEscape?: () => void;
}

const SHOWN_BUTTONS = 7;
const COMPACT_BUTTONS = 2;

const MORE_ICON = { component: ChevronRight, size: ICON_SIZE };
const BACK_ICON = { component: ChevronLeft, size: ICON_SIZE };

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
export const ItemMenu: FC<Props> = ({ itemName, actions, compact = false, onEscape }) => {
    const [revealed, setRevealed] = useState(false);
    const menu = useRef<HTMLDivElement>(null);
    const more = useRef<HTMLButtonElement>(null);
    const shownButtons = compact ? COMPACT_BUTTONS : SHOWN_BUTTONS;
    const shownActions = actions.slice(0, shownButtons);
    const moreActions = actions.slice(shownButtons);
    const visibleActions = compact && revealed ? moreActions : shownActions;
    const expandedActions = !compact && revealed ? moreActions : [];

    useLayoutEffect(() => {
        if (!revealed) {
            return;
        }

        // Focus goes on from the More button, which is gone, to what it revealed,
        // or to the bar's last button that may be pressed when none of that may.
        const enabled = [...(menu.current?.querySelectorAll('button') ?? [])]
            .map((button, index) => ({
                button,
                revealed: index >= (compact ? 0 : shownActions.length)
            }))
            .filter(({ button }) => !button.disabled);
        const target = (enabled.find(({ revealed }) => revealed) ?? enabled.at(-1))?.button;

        target?.focus();
    }, [compact, revealed, shownActions.length]);

    return (
        <div
            ref={menu}
            className={styles.menu}
            role="toolbar"
            aria-label={`${itemName} menu`}
            onKeyDown={(event) => {
                if (event.key !== 'Escape' || !onEscape) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                onEscape();
            }}
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
            {visibleActions.map((action) => (
                <MenuButton key={action.id} action={action} />
            ))}
            {expandedActions.map((action) => (
                <MenuButton key={action.id} action={action} />
            ))}
            {moreActions.length > 0 && (compact || !revealed) && (
                <button
                    key="more"
                    ref={more}
                    type="button"
                    className={styles.button}
                    title={compact && revealed ? 'Back' : 'More'}
                    aria-label={compact && revealed ? 'Back' : 'More'}
                    aria-expanded={revealed}
                    onClick={() => setRevealed(!revealed)}
                >
                    <Icon icon={compact && revealed ? BACK_ICON : MORE_ICON} />
                </button>
            )}
        </div>
    );
};
