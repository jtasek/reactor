import React from 'react';
import { NavBarList } from './NavBarList';
import { NavBarListItem } from './NavBarListItem';
import { useActions, useCurrentDocument, useGroup } from 'src/app/hooks';

const GroupListItem = ({ groupId }: { groupId: string }) => {
    const group = useGroup(groupId);
    const { toggleGroupSelected, toggleGroupLocked, toggleGroupVisible } = useActions();

    return (
        <NavBarListItem
            key={groupId}
            id={groupId}
            name={group.name}
            selected={group.selected}
            locked={group.locked}
            visible={group.visible}
            onClick={toggleGroupSelected}
            onToggleLocked={toggleGroupLocked}
            onToggleVisible={toggleGroupVisible}
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
            {groupsIds.map((groupId: string) => (
                <GroupListItem key={groupId} groupId={groupId} />
            ))}
        </NavBarList>
    );
};
