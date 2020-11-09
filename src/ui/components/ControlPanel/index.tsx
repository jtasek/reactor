import React, { FC } from 'react';

import { ControlPanel } from './ControlPanel';
import { useApp } from 'src/app/hooks';

export const ConnectedControlPanel: FC = () => {
  const { state, actions } = useApp();

  if (!state.ui.controlPanel.visible) {
    return null;
  }

  return (
    <ControlPanel
      controls={Object.values(state.ui)}
      onChange={actions.ui.toggleControlVisibility}
    />
  );
};
