import React, { FC } from 'react';
import { useState } from 'src/app/hooks';
import { Grid } from './Grid';

export const GridContainer: FC = () => {
  const {
    currentDocument: { camera },
    ui: { grid }
  } = useState();

  if (!grid.visible) {
    return null;
  }

  return <Grid key="grid" camera={camera} grid={grid} />;
};
