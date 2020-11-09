import React, { FC } from 'react';
import { useState } from 'src/app/hooks';
import { Grid } from './Grid';

export const GridContainer: FC = () => {
  const state = useState();

  const camera = state.currentDocument.camera;
  const grid = state.ui.grid;

  if (!grid.visible) {
    return null;
  }

  return <Grid camera={camera} grid={grid} />;
};
