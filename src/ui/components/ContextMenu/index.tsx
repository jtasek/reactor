import React, { FC } from 'react';

import { useControls } from 'src/app/hooks';
import { ConnectedContextMenu as ContextMenu } from './ContextMenu';

export const ConnectedContextMenu: FC = () => {
  const { contextMenu } = useControls();

  if (!contextMenu.visible) {
    return null;
  }

  return <ContextMenu />;
};

export default ConnectedContextMenu;
