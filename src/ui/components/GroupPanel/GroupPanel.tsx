import React, { FC } from 'react';
import styles from './styles.css';
import { GroupPanelItem } from './GroupPanelItem';

export interface Props {
  groupsIds: string[];
}

export const GroupPanel: FC<Props> = ({ groupsIds }) => (
  <ul data-cy="group-panel" className={styles.groupPanel}>
    {groupsIds.map((groupId) => (
      <GroupPanelItem key={groupId} groupId={groupId} />
    ))}
  </ul>
);
