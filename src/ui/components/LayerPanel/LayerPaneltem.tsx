import React, { FC } from 'react';
import { Icon } from '../Icon';
import styles from './styles.css';
import { Layer } from '../../../app/types';

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
  layer: Layer;
}

export const LayerPanelItem: FC<Props> = ({ layer }) => (
  <li className={styles.layerItem}>
    <label>
      <input type="checkbox" value={layer.name} checked={layer.visible} />
      {layer.name}
    </label>
    <Icon icon={layer.visible ? visibleIcon : hiddenIcon} />
    <Icon icon={layer.locked ? lockedIcon : openIcon} />
  </li>
);
