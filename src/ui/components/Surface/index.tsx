import React, { FC } from 'react';
import { Camera } from './Camera';
import { ConnectedOverlay as Overlay } from '../Overlay';
import { ErrorBoundary } from '../ErrorBoundary';
import { GridContainer as Grid } from '../Grid';
import { Rulers } from './Rulers';
import { Shapes } from './Shapes';
import { Stack } from 'src/tools/components/Stack';
import { Surface } from './Surface';

export const Canvas: FC = () => (
  <Surface>
    <Grid />
    <Rulers />
    <Camera>
      <ErrorBoundary fallback={<h1>Something went wrong while rendering shapes</h1>}>
        <Shapes />
        <Stack />
      </ErrorBoundary>
    </Camera>
    <Overlay />
  </Surface>
);
