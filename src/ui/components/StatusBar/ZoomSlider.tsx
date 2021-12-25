import React, { FC } from 'react';

import { useActions, useState} from 'src/app/hooks';

import { Slider } from '../Slider';

export const ZoomSlider: FC = () => {
  const { scale } = useState(state => state.currentDocument.camera);
  const actions= useActions();

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
