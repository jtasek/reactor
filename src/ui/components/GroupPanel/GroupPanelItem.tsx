import { useShapesFrameState } from 'src/app/frameHooks';
import React, { FC } from 'react';
import { Eye, EyeOff, Lock, LockOpen } from 'lucide-react';
import styles from './styles.css';
import { Icon } from '../Icon';
import { useActions, useGroup, useGroupSelected } from 'src/app/hooks';

const visibleIcon = {
    component: Eye,
    size: 16
};

const hiddenIcon = {
    component: EyeOff,
    size: 16
};

const lockedIcon = {
    component: Lock,
    size: 16
};

const openIcon = {
    component: LockOpen,
    size: 16
};

interface Props {
    groupId: string;
}

export const GroupPanelItem: FC<Props> = ({ groupId }) => {
    const { name, locked, visible, shapesIds } = useGroup(groupId);
    const inherited = useShapesFrameState(shapesIds);
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
                        disabled={inherited.locked}
                        onClick={() => toggleGroupVisible(groupId)}
                    >
                        <Icon icon={visible ? visibleIcon : hiddenIcon} />
                    </button>
                </li>
                <li>
                    <button
                        type="button"
                        title={locked ? 'Unlock' : 'Lock'}
                        disabled={inherited.locked}
                        onClick={() => toggleGroupLocked(groupId)}
                    >
                        <Icon icon={locked ? lockedIcon : openIcon} />
                    </button>
                </li>
            </ul>
        </li>
    );
};
