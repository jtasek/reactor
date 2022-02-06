import React from 'react';
import { NavBarList } from './NavBarList';
import { NavBarListItem } from './NavBarListItem';
import { useActions, useCurrentDocument, useGroup } from 'src/app/hooks';

const GroupListItem = ({ groupId }) => {
  const group = useGroup(groupId);
  const { toggleGroupSelected } = useActions();

  return (
    <NavBarListItem
      key={groupId}
      id={groupId}
      name={group.name}
      selected={group.selected}
      onClick={toggleGroupSelected}
    />
  );
};

export const GroupsList = () => {
  const { groupsIds } = useCurrentDocument();

  if (groupsIds?.length === 0) {
    return null;
  }

  return (
    <NavBarList name="Groups">
      {groupsIds.map((groupId) => (
        <GroupListItem key={groupId} groupId={groupId} />
      ))}
    </NavBarList>
  );
};
