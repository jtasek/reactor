import React, { FC } from 'react';
import { Ruler } from '../Ruler';
import { useState } from 'src/app/hooks';

export const Rulers: FC = () => {
  const { currentDocument } = useState();

  const { scale } = currentDocument.camera;

  return (
    <g id="rulers">
      {Object.values(currentDocument.rulers).map((ruler) => (
        <Ruler key={ruler.id} ruler={ruler} scale={scale} />
      ))}
    </g>
  );
};