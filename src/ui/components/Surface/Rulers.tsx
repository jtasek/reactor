import React, { FC } from 'react';
import { Ruler } from '../Ruler';
import { useState } from 'src/app/hooks';
import { Camera } from 'src/app/types';

interface Props {
  camera?: Camera;
}

export const Rulers: FC<Props> = ({ camera }) => {
  const {
    currentDocument,
    ui: { rulers }
  } = useState();

  if (!rulers.visible) {
    return null;
  }

  const { position, scale } = camera ?? currentDocument.camera;

  return (
    <g id="rulers">
      {Object.values(currentDocument.rulers).map((ruler) => (
        <Ruler key={ruler.id} ruler={ruler} position={position} scale={scale} />
      ))}
    </g>
  );
};
