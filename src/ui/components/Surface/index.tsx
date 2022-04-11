import React, { FC } from 'react';
import { DesignStack as Stack } from 'src/tools/components/Stack';
import { GridContainer as Grid } from '../Grid';
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
    </Camera>
    <Stack />
    <Overlay />
  </Surface>
);
