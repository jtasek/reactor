import React, { FC } from 'react';
import { Eye, EyeOff, Lock, LockOpen } from 'lucide-react';
import styles from './styles.css';
import { Icon } from '../Icon';
import { useActions, useLayer } from 'src/app/hooks';

const LAYER_ICON_SIZE = 16;

const visibleIcon = {
    component: Eye,
    size: LAYER_ICON_SIZE
};

const hiddenIcon = {
    component: EyeOff,
    size: LAYER_ICON_SIZE
};

const lockedIcon = {
    component: Lock,
    size: LAYER_ICON_SIZE
};

const openIcon = {
    component: LockOpen,
    size: LAYER_ICON_SIZE
};

interface Props {
    layerId: string;
}

export const LayerPanelItem: FC<Props> = ({ layerId }) => {
    const { name, locked, selected, visible } = useLayer(layerId);
    const { toggleLayerLocked, toggleLayerSelected, toggleLayerVisible } = useActions();

    return (
        <li className={styles.layerItem}>
            <label className={styles.layerLabel}>
                <input
                    type="checkbox"
                    value={name}
                    checked={selected}
                    onChange={() => toggleLayerSelected(layerId)}
                />
                {name}
            </label>
            <ul
                className={styles.icons}
                style={{ display: 'flex', justifyItems: 'center', alignItems: 'center' }}
            >
                <li>
                    <button
                        type="button"
                        title={visible ? 'Hide' : 'Show'}
                        onClick={() => toggleLayerVisible(layerId)}
                    >
                        <Icon icon={visible ? visibleIcon : hiddenIcon} />
                    </button>
                </li>
                <li>
                    <button
                        type="button"
                        title={locked ? 'Unlock' : 'Lock'}
                        onClick={() => toggleLayerLocked(layerId)}
                    >
                        <Icon icon={locked ? lockedIcon : openIcon} />
                    </button>
                </li>
            </ul>
        </li>
    );
};
