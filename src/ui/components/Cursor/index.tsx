import React, { FC } from 'react';
import { usePointer } from 'src/app/hooks';
import { Cursor } from './Cursor';

export const ConnectedCursor: FC = () => {
  const { position } = usePointer();

  return <Cursor position={position} />;
};
