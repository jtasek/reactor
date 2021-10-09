import React, { FC } from 'react';
import styles from './styles.css';
import { Group } from 'src/app/types';
import { GroupPanelItem } from './GroupPanelItem';

export interface Props {
  groups: Group[];
  onChange: (groupId: string, visible: boolean) => void;
}

export const GroupPanel: FC<Props> = ({ groups, onChange }) => (
  <ul data-cy="group-panel" className={styles.groupPanel}>
    {groups.map((group) => (
      <GroupPanelItem key={group.id} group={group} onChange={onChange} />
    ))}
  </ul>
);
