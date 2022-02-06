import React, { FC } from 'react';
import styles from './styles.css';
import { Icon } from '../Icon';
import { useActions, useGroup } from 'src/app/hooks';

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
  const { name, visible, locked } = useGroup(groupId);
  const { toggleGroupVisible } = useActions();

  return (
    <li className={styles.groupItem}>
      <label className={styles.groupLabel}>
        <input
          type="checkbox"
          value={name}
          checked={visible}
          onChange={(e) => toggleGroupVisible(groupId)}
        />
        {name}
      </label>
      <div className={styles.icons}>
        <Icon icon={visible ? visibleIcon : hiddenIcon} />
        <Icon icon={locked ? lockedIcon : openIcon} />
      </div>
    </li>
  );
};
