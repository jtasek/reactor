import React, { FC } from 'react';

import { useCamera, useControls } from 'src/app/hooks';
import { Grid } from './Grid';

export const GridContainer: FC = () => {
  const { grid } = useControls();
  const camera = useCamera();

  if (!grid.visible) {
    return null;
  }

  return <Grid key="grid" camera={camera} grid={grid} />;
};
