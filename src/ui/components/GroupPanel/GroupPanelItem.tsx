import React, { FC } from 'react';
import styles from './styles.css';
import { Icon } from '../Icon';
import { useActions, useGroup, useGroupSelected } from 'src/app/hooks';

const visibleIcon = {
    group: 'action',
    name: 'visibility',
    color: 'rgba(255,255,255)',
    size: 16
};

const hiddenIcon = {
    group: 'action',
    name: 'visibility_off',
    color: 'rgba(255,255,255)',
    size: 16
};

const lockedIcon = {
    group: 'action',
    name: 'lock_outline',
    color: 'rgba(255,255,255)',
    size: 16
};

const openIcon = {
    group: 'action',
    name: 'lock_open',
    color: 'rgba(255,255,255)',
    size: 16
};

interface Props {
    groupId: string;
}

export const GroupPanelItem: FC<Props> = ({ groupId }) => {
    const { name, locked, visible } = useGroup(groupId);
    const selected = useGroupSelected(groupId);
    const { toggleGroupLocked, toggleGroupSelected, toggleGroupVisible } = useActions();

    return (
        <li className={styles.groupItem}>
            <label className={styles.groupLabel}>
                <input
                    type="checkbox"
                    value={name}
                    checked={selected}
                    onChange={() => toggleGroupSelected(groupId)}
                />
                {name}
            </label>
            <ul className={styles.icons}>
                <li>
                    <button
                        type="button"
                        title={visible ? 'Hide' : 'Show'}
                        onClick={() => toggleGroupVisible(groupId)}
                    >
                        <Icon icon={visible ? visibleIcon : hiddenIcon} />
                    </button>
                </li>
                <li>
                    <button
                        type="button"
                        title={locked ? 'Unlock' : 'Lock'}
                        onClick={() => toggleGroupLocked(groupId)}
                    >
                        <Icon icon={locked ? lockedIcon : openIcon} />
                    </button>
                </li>
            </ul>
        </li>
    );
};
