import React, { FC } from 'react';

import { useApp } from 'src/app/hooks';
import { CommandLine } from './CommandLine';

export const ConnectedCommandLine: FC = () => {
  const { actions, state } = useApp();

  if (!state.ui.commandLine.visible) {
    return null;
  }

  return <CommandLine onChange={actions.executeCommand} />;
};

export default ConnectedCommandLine;
