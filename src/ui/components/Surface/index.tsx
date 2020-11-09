import React, { FC } from 'react';
import { DynamicStack as Stack } from 'src/tools/components/Stack';
import { GridContainer as Grid } from '../Grid';
import { Handle } from '../Handle';
import { ConnectedOverlay as Overlay } from '../Overlay';
import { Camera } from './Camera';
import { Rulers } from './Rulers';
import { Shapes } from './Shapes';
import { Surface } from './Surface';

export const SurfaceContainer: FC = () => {
  return (
    <Surface>
      <Camera>
        <Grid />
        <Rulers />
        <Shapes />
        <Handle position={{ x: 500, y: 500 }} size={5} />
        <Handle position={{ x: 600, y: 500 }} size={5} />
        <Handle position={{ x: 550, y: 600 }} size={5} />
        <Stack />
      </Camera>
      <Overlay />
    </Surface>
  );
};
