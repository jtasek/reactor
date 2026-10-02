import React, { FC, useState } from 'react';
import type { Command, Icon as IconType } from 'src/app/types';
import { Icon } from '../Icon';
import styles from './styles.css';

/** A button of an item's menu. */
export interface ItemMenuAction {
    id: string;
    /** Said by the button's tooltip and to screen readers. */
    label: string;
    icon: IconType;
    /** For a button that switches something on and off: whether it is on. */
    pressed?: boolean;
    disabled?: boolean;
    onRun: () => void;
}

const ICON_SIZE = 16;

/** A menu button that runs a command, with the command's name and icon. */
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

/** A menu button that switches something on and off, as hiding or locking. */
export const toggleAction = (
    id: string,
    pressed: boolean,
    { on, off }: Record<'on' | 'off', { label: string; group?: string; icon: string }>,
    onRun: () => void
): ItemMenuAction => {
    const { label, group = 'action', icon } = pressed ? on : off;

    return { id, label, icon: { group, name: icon, size: ICON_SIZE }, pressed, onRun };
};

interface Props {
    /** What the menu is for, as "shape-1". */
    label: string;
    /** The buttons always in the bar: the most used ones. */
    actions: ItemMenuAction[];
    /** The buttons rolled out by the More button. */
    more?: ItemMenuAction[];
}

const moreIcon = (open: boolean) => ({
    group: 'navigation',
    name: open ? 'expand_less' : 'expand_more',
    size: ICON_SIZE
});

const MenuButton: FC<{ action: ItemMenuAction; onRun: () => void }> = ({
    action: { label, icon, pressed, disabled },
    onRun
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
 * The menu of a shape, group or layer: a small rounded bar of round buttons,
 * with the rest rolled out under it by its More button. Inside an element marked
 * `data-menu-host`, it fades in while the pointer is over that element or the
 * keyboard's focus is in it; buttons switched on stay shown.
 */
export const ItemMenu: FC<Props> = ({ label, actions, more = [] }) => {
    const [open, setOpen] = useState(false);

    return (
        <div
            className={styles.menu}
            role="toolbar"
            aria-label={`${label} menu`}
            onMouseLeave={() => setOpen(false)}
        >
            {actions.map((action) => (
                <MenuButton key={action.id} action={action} onRun={action.onRun} />
            ))}
            {more.length > 0 && (
                <button
                    type="button"
                    className={styles.button}
                    title="More"
                    aria-label="More"
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                >
                    <Icon icon={moreIcon(open)} />
                </button>
            )}
            {open && (
                <div className={styles.more}>
                    {more.map((action) => (
                        <MenuButton
                            key={action.id}
                            action={action}
                            onRun={() => {
                                setOpen(false);
                                action.onRun();
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
