import React, { FC } from 'react';

import { useState } from 'src/app/hooks';
import { ContextMenu } from './ContextMenu';

export const ConnectedContextMenu: FC = () => {
  const { ui } = useState();

  if (!ui.contextMenu.visible) {
    return null;
  }

  return <ContextMenu position={ui.contextMenu.position} />;
};

export default ConnectedContextMenu;
