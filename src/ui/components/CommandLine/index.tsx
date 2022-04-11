import React, { FC } from 'react';

import { useActions, useControls } from 'src/app/hooks';
import { CommandLine } from './CommandLine';

export const ConnectedCommandLine: FC = () => {
  const { commandLine } = useControls();
  const actions = useActions();

  if (!commandLine.visible) {
    return null;
  }

  return <CommandLine onChange={() => actions.executeCommand} />;
};

export default ConnectedCommandLine;
