import React, { FC } from 'react';
import { useState } from 'src/app/hooks';
import { Cursor } from './Cursor';

export const ConnectedCursor: FC = () => {
  const { position: position } = useState().events.pointer;

  return <Cursor position={position} />;
};
