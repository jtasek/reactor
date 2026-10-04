import React, { FC } from 'react';
import styles from './styles.css';
import { Icon } from '../Icon';
import { useActions, useLayer, useShownLayerId } from 'src/app/hooks';

const LAYER_ICON_SIZE = 16;

const visibleIcon = {
    group: 'action',
    name: 'visibility',
    color: 'rgba(255,255,255)',
    size: LAYER_ICON_SIZE
};

const hiddenIcon = {
    group: 'action',
    name: 'visibility_off',
    color: 'rgba(255,255,255)',
    size: LAYER_ICON_SIZE
};

const lockedIcon = {
    group: 'action',
    name: 'lock_outline',
    color: 'rgba(255,255,255)',
    size: LAYER_ICON_SIZE
};

const openIcon = {
    group: 'action',
    name: 'lock_open',
    color: 'rgba(255,255,255)',
    size: LAYER_ICON_SIZE
};

interface Props {
    layerId: string;
    onHighlight?: () => void;
}

export const LayerPanelItem: FC<Props> = ({ layerId, onHighlight }) => {
    const { name, locked, selected, visible } = useLayer(layerId);
    const shownLayerId = useShownLayerId();
    const { showOnlyLayer, toggleLayerLocked, toggleLayerSelected, toggleLayerVisible } =
        useActions();

    return (
        <li className={styles.layerItem}>
            <div className={styles.layerLabel}>
                <input
                    type="checkbox"
                    value={name}
                    checked={selected}
                    aria-label={`Select ${name}`}
                    onChange={() => toggleLayerSelected(layerId)}
                />
                <button
                    type="button"
                    data-layer-highlight
                    aria-pressed={shownLayerId === layerId}
                    onClick={() => {
                        showOnlyLayer(layerId);
                        onHighlight?.();
                    }}
                >
                    {name}
                </button>
            </div>
            <ul
                className={styles.icons}
                style={{ display: 'flex', justifyItems: 'center', alignItems: 'center' }}
            >
                <li>
                    <button
                        type="button"
                        title={visible ? 'Hide' : 'Show'}
                        aria-label={`${visible ? 'Hide' : 'Show'} ${name}`}
                        onClick={() => toggleLayerVisible(layerId)}
                    >
                        <Icon icon={visible ? visibleIcon : hiddenIcon} />
                    </button>
                </li>
                <li>
                    <button
                        type="button"
                        title={locked ? 'Unlock' : 'Lock'}
                        aria-label={`${locked ? 'Unlock' : 'Lock'} ${name}`}
                        onClick={() => toggleLayerLocked(layerId)}
                    >
                        <Icon icon={locked ? lockedIcon : openIcon} />
                    </button>
                </li>
            </ul>
        </li>
    );
};
