import React, { FC } from 'react';

import { useState } from 'src/app/hooks';
import { ConnectedContextMenu as ContextMenu } from './ContextMenu';

export const ConnectedContextMenu: FC = () => {
  const { ui } = useState();

  if (!ui.contextMenu.visible) {
    return null;
  }

  return <ContextMenu />;
};

export default ConnectedContextMenu;
