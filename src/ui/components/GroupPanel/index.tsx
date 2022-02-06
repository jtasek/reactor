import React, { FC } from 'react';
import { useCurrentDocument, useAppState } from 'src/app/hooks';

import { GroupPanel } from './GroupPanel';

export const GroupPanelContainer: FC = () => {
  const { groupsIds } = useCurrentDocument();
  const { visible } = useAppState((state) => state.ui.groupPanel);

  if (!visible) {
    return null;
  }

  return <GroupPanel groupsIds={groupsIds} />;
};
