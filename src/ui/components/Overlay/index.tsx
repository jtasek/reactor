import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';
import { Overlay } from './Overlay';

export const ConnectedOverlay: FC = () => {
  const { visible } = useAppState().ui.overlay;

  if (!visible) {
    return null;
  }

  return <Overlay />;
};
