import React, { FC } from 'react';
import { useState } from 'src/app/hooks';

export const Camera: FC = ({ children }) => {
  const { currentDocument } = useState();

  const { scale, position } = currentDocument.camera;

  return <g transform={`translate(${position.x},${position.y}) scale(${scale})`}>{children}</g>;
};
