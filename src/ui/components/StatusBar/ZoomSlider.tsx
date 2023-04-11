import React, { FC } from 'react';

import { useActions, useCamera } from 'src/app/hooks';

import { Slider } from '../Slider';

const MAX_SCALE = 10;
const MIN_SCALE = 0.1;
const ZOOM_STEP = 0.1;

export const ZoomSlider: FC = () => {
  const { scale } = useCamera();
  const { tools } = useActions();

  return (
    <Slider
      min={MIN_SCALE}
      max={MAX_SCALE}
      step={ZOOM_STEP}
      value={scale}
      onChange={(value: number) => tools.zoom(value)}
    />
  );
};
