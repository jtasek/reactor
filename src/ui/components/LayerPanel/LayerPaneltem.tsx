import React, { FC } from 'react';
import styles from './styles.css';
import { Icon } from '../Icon';
import { useActions, useLayer } from 'src/app/hooks';

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
        <li onClick={() => toggleLayerVisible(layerId)}>
          <Icon icon={visible ? visibleIcon : hiddenIcon} />
        </li>
        <li onClick={() => toggleLayerLocked(layerId)}>
          <Icon icon={locked ? lockedIcon : openIcon} />
        </li>
      </ul>
    </li>
  );
};
