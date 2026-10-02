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
    /** Where the More button rolls its buttons out: under the bar's end unless said. */
    moreAbove?: boolean;
    moreFromStart?: boolean;
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
 * Inside an element marked `data-menu-host`, the menu fades in while the pointer
 * is over that element or the keyboard's focus is in it; pressed buttons stay shown.
 */
export const ItemMenu: FC<Props> = ({
    itemName,
    actions,
    moreActions = [],
    moreAbove = false,
    moreFromStart = false
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
                    <Icon icon={moreIcon(open)} />
                </button>
            )}
            {open && (
                <div
                    className={[
                        styles.more,
                        moreAbove && styles.above,
                        moreFromStart && styles.fromStart
                    ]
                        .filter(Boolean)
                        .join(' ')}
                >
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
