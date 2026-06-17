import React, { FC } from 'react';
import styles from './styles.css';
import { Icon } from '../Icon';

const visibleIcon = { group: 'action', name: 'visibility', color: 'rgba(255,255,255)', size: 16 };
const hiddenIcon = {
    group: 'action',
    name: 'visibility_off',
    color: 'rgba(255,255,255)',
    size: 16
};
const lockedIcon = { group: 'action', name: 'lock_outline', color: 'rgba(255,255,255)', size: 16 };
const openIcon = { group: 'action', name: 'lock_open', color: 'rgba(255,255,255)', size: 16 };

interface Props {
    id: string;
    name: string;
    selected: boolean;
    active?: boolean;
    locked?: boolean;
    visible?: boolean;
    onClick: (id: string) => void;
    onToggleLocked?: (id: string) => void;
    onToggleVisible?: (id: string) => void;
}

export const NavBarListItem: FC<Props> = ({
    id,
    name,
    selected,
    active = false,
    locked = false,
    visible = true,
    onClick,
    onToggleLocked,
    onToggleVisible
}) => {
    const state = selected ? styles.selected : active ? styles.active : '';
    const className = [styles.item, state, visible ? '' : styles.hidden].filter(Boolean).join(' ');

    return (
        <li className={className}>
            <a className={styles.itemName} onClick={() => onClick(id)}>
                {name}
            </a>
            {(onToggleVisible || onToggleLocked) && (
                <span className={styles.itemIcons}>
                    {onToggleVisible && (
                        <span
                            className={styles.itemIcon}
                            title={visible ? 'Hide' : 'Show'}
                            onClick={() => onToggleVisible(id)}
                        >
                            <Icon icon={visible ? visibleIcon : hiddenIcon} />
                        </span>
                    )}
                    {onToggleLocked && (
                        <span
                            className={styles.itemIcon}
                            title={locked ? 'Unlock' : 'Lock'}
                            onClick={() => onToggleLocked(id)}
                        >
                            <Icon icon={locked ? lockedIcon : openIcon} />
                        </span>
                    )}
                </span>
            )}
        </li>
    );
};
