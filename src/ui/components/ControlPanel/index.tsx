import React, { FC } from 'react';

import { ControlPanel } from './ControlPanel';
import { useActions, useAppState} from 'src/app/hooks';

export const ConnectedControlPanel: FC = () => {
  const state = useAppState();
  const actions= useActions();

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
