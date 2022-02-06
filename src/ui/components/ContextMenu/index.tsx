import React, { FC } from 'react';

import { useAppState } from 'src/app/hooks';
import { ConnectedContextMenu as ContextMenu } from './ContextMenu';

export const ConnectedContextMenu: FC = () => {
  const { ui } = useAppState();

  if (!ui.contextMenu.visible) {
    return null;
  }

  return <ContextMenu />;
};

export default ConnectedContextMenu;
