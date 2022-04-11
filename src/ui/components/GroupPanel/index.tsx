import React, { FC } from 'react';

import { useCurrentDocument, useControls } from 'src/app/hooks';

import { GroupPanel } from './GroupPanel';

export const GroupPanelContainer: FC = () => {
  const { groupsIds } = useCurrentDocument();
  const { groupPanel } = useControls();

  if (!groupPanel.visible) {
    return null;
  }

  return <GroupPanel groupsIds={groupsIds} />;
};
