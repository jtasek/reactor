import React, { FC } from 'react';
import { useApp } from 'src/app/hooks';
import { ToolBar } from './ToolBar';

export const ToolBarContainer: FC = () => {
  const { actions, state } = useApp();

  if (!state.ui.toolBar.visible) {
    return null;
  }

  return <ToolBar tools={[]} onClick={actions.tools.activateTool} />;
};
