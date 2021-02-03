import React, { FC } from 'react';
import { DesignStack as Stack } from 'src/tools/components/Stack';
import { GridContainer as Grid } from '../Grid';
import { Handle } from '../Handle';
import { ConnectedOverlay as Overlay } from '../Overlay';
import { Camera } from './Camera';
import { Rulers } from './Rulers';
import { Shapes } from './Shapes';
import { Surface } from './Surface';

export const SurfaceContainer: FC = () => (
  <Surface>
    <Grid />
    <Rulers />
    <Camera>
      <Shapes />
      <Handle position={{ x: 500, y: 500 }} size={5} />
      <Handle position={{ x: 600, y: 500 }} size={5} />
      <Handle position={{ x: 500, y: 600 }} size={5} />
      <Handle position={{ x: 600, y: 600 }} size={5} />
    </Camera>
    <Stack />
    <Overlay />
  </Surface>
);
