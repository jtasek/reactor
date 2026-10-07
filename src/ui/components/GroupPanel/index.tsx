import React, { FC } from 'react';

import { useControls, useGroupsIds } from 'src/app/hooks';

import { GroupPanel } from './GroupPanel';

export const GroupPanelContainer: FC = () => {
    const groupsIds = useGroupsIds();
    const { groupPanel } = useControls();

    if (!groupPanel.visible) {
        return null;
    }

    return <GroupPanel groupsIds={[...groupsIds]} />;
};
