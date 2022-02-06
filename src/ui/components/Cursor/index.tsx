import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';
import { Cursor } from './Cursor';

export const ConnectedCursor: FC = () => {
  const { position: position } = useAppState().events.pointer;

  return <Cursor position={position} />;
};
