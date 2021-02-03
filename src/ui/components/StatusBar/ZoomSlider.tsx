import React, { FC } from 'react';

import { useApp } from 'src/app/hooks';

import { Slider } from '../Slider';

export const ZoomSlider: FC = () => {
  const { actions, state } = useApp();

  const { scale } = state.currentDocument.camera;

  return (
    <Slider
      min={0.1}
      max={5.0}
      step={0.05}
      value={scale}
      onChange={(value: number) => actions.tools.zoom(value)}
    />
  );
};
