import React, { FC } from 'react';

import { ControlPanel } from './ControlPanel';
import { useActions, useAppState, useControls } from 'src/app/hooks';

export const ConnectedControlPanel: FC = () => {
  const controls = useControls();
  const actions = useActions();

  if (!controls.controlPanel.visible) {
    return null;
  }

  return (
    <ControlPanel
      controls={Object.values(controls)}
      onChange={actions.ui.toggleControlVisibility}
    />
  );
};
