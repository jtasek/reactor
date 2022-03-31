import React, { FC } from 'react';
import styles from './styles.css';
import { GroupPanelItem } from './GroupPanelItem';

export interface Props {
  groupsIds: string[];
}

export const GroupPanel: FC<Props> = ({ groupsIds }) => {
  const showGroups = groupsIds.length > 0;

  return (
    <ul data-cy="group-panel" className={styles.groupPanel}>
      {!showGroups && <li>No groups available</li>}
      {showGroups && groupsIds.map((groupId) => <GroupPanelItem key={groupId} groupId={groupId} />)}
    </ul>
  );
};
