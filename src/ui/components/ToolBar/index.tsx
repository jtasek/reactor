import React, { FC } from 'react';
import { useActions, useState } from 'src/app/hooks';
import { ToolBar } from './ToolBar';

export const ToolBarContainer: FC = () => {
  const { toolBar } = useState(state => state.ui);
  const actions = useActions();

  if (!toolBar.visible) {
    return null;
  }

  return <ToolBar onClick={actions.tools.activateTool} />;
};
