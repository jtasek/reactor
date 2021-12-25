import React, { FC } from 'react';

import { useActions, useState } from 'src/app/hooks';
import { CommandLine } from './CommandLine';

export const ConnectedCommandLine: FC = () => {
  const { commandLine} = useState(state => state.ui);
  const actions = useActions();

  if (!commandLine.visible) {
    return null;
  }

  return <CommandLine onChange={actions.executeCommand} />;
};

export default ConnectedCommandLine;
