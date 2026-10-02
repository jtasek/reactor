import React, { FC, useState } from 'react';
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

interface Props {
    itemName: string;
    actions: ItemMenuAction[];
    moreActions?: ItemMenuAction[];
    /** Rolls the More button's buttons out to the right of the bar, not under it. */
    moreBeside?: boolean;
}

const MORE_ICONS = {
    under: { closed: 'expand_more', open: 'expand_less' },
    beside: { closed: 'chevron_right', open: 'chevron_left' }
};

const moreIcon = (open: boolean, beside: boolean) => ({
    group: 'navigation',
    name: MORE_ICONS[beside ? 'beside' : 'under'][open ? 'open' : 'closed'],
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
 * Inside an element marked `data-menu-host`, the menu fades in while the pointer
 * is over that element or the keyboard's focus is in it; pressed buttons stay shown.
 */
export const ItemMenu: FC<Props> = ({
    itemName,
    actions,
    moreActions = [],
    moreBeside = false
}) => {
    const [open, setOpen] = useState(false);

    return (
        <div
            className={styles.menu}
            role="toolbar"
            aria-label={`${itemName} menu`}
            onMouseLeave={() => setOpen(false)}
        >
            {actions.map((action) => (
                <MenuButton key={action.id} action={action} onRun={action.onRun} />
            ))}
            {moreActions.length > 0 && (
                <button
                    type="button"
                    className={styles.button}
                    title="More"
                    aria-label="More"
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                >
                    <Icon icon={moreIcon(open, moreBeside)} />
                </button>
            )}
            {open && (
                <div className={moreBeside ? `${styles.more} ${styles.beside}` : styles.more}>
                    {moreActions.map((action) => (
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
