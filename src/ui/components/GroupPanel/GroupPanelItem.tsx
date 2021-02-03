import React, { FC } from 'react';
import { Icon } from '../Icon';
import { Group } from '../../../app/types';

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
  group: Group;
}

export const GroupPanelItem: FC<Props> = ({ group }) => (
  <li>
    <label>
      <input type="checkbox" value={group.name} checked={group.visible} />
      {group.name}
      <Icon icon={group.visible ? visibleIcon : hiddenIcon} />
      <Icon icon={group.locked ? lockedIcon : openIcon} />
    </label>
  </li>
);
