import React, { FC } from 'react';
import styles from './styles.css';
import { Group } from 'src/app/types';
import { GroupPanelItem } from './GroupPanelItem';

export interface Props {
  groups: Group[];
}

export const GroupPanel: FC<Props> = ({ groups }) => (
  <ul className={styles.groupPanel}>
    {groups.map((group) => (
      <GroupPanelItem key={group.id} group={group} />
    ))}
  </ul>
);
