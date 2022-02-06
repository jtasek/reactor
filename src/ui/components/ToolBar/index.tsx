import React, { FC } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { ToolBar } from './ToolBar';

export const ToolBarContainer: FC = () => {
  const { toolBar } = useAppState(state => state.ui);
  const actions = useActions();

  if (!toolBar.visible) {
    return null;
  }

  return <ToolBar onClick={actions.tools.activateTool} />;
};
