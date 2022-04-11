import React, { FC } from 'react';
import { Ruler } from '../Ruler';
import { useCamera, useControls, useRulers } from 'src/app/hooks';
import { Camera } from 'src/app/types';

interface Props {
  camera?: Camera;
}

export const Rulers: FC<Props> = ({ camera }) => {
  const { rulers: control } = useControls();
  const rulers = useRulers();
  const defaultCamera = useCamera();

  if (!control.visible) {
    return null;
  }

  const { position, scale } = camera ?? defaultCamera;

  return (
    <g id="rulers">
      {Object.values(rulers).map((ruler) => (
        <Ruler key={ruler.id} ruler={ruler} position={position} scale={scale} />
      ))}
    </g>
  );
};
