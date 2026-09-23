import React, { FC } from 'react';

import { useActions, useCamera } from 'src/app/hooks';
import { MAX_SCALE, MIN_SCALE, ZOOM_STEP } from 'src/app/camera';

import { Slider } from '../Slider';

export const ZoomSlider: FC = () => {
    const { scale } = useCamera();
    const { tools } = useActions();

    return (
        <Slider
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={ZOOM_STEP}
            value={scale}
            onChange={(scale: number) => tools.zoom({ scale })}
        />
    );
};
