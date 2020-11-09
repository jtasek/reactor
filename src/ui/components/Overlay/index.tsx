import React, { FC } from 'react';
import { useState } from 'src/app/hooks';
import { Overlay } from './Overlay';

export const ConnectedOverlay: FC = () => {
  const { visible } = useState().ui.overlay;

  if (!visible) {
    return null;
  }

  return <Overlay />;
};
