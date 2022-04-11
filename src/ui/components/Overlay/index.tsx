import React, { FC } from 'react';

import { useControls } from 'src/app/hooks';
import { Overlay } from './Overlay';

export const ConnectedOverlay: FC = () => {
  const { overlay } = useControls();

  if (!overlay.visible) {
    return null;
  }

  return <Overlay />;
};
