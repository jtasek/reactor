import React, { FC } from 'react';

import { useActions, useControls } from 'src/app/hooks';
import { ToolBar } from './ToolBar';

export const ToolBarContainer: FC = () => {
  const { toolBar } = useControls();
  const actions = useActions();

  if (!toolBar.visible) {
    return null;
  }

  return <ToolBar onClick={actions.tools.activateTool} />;
};
