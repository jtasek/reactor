import React, { FC } from 'react';
import { useState } from 'src/app/hooks';

import { GroupPanel } from './GroupPanel';

export const GroupPanelContainer: FC = () => {
  const { currentDocument, ui } = useState();

  if (!ui.groupPanel.visible) {
    return null;
  }

  return <GroupPanel groups={Object.values(currentDocument.groups)} />;
};
