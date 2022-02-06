import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';
import { Grid } from './Grid';

export const GridContainer: FC = () => {
  const {
    currentDocument: { camera },
    ui: { grid }
  } = useAppState();

  if (!grid.visible) {
    return null;
  }

  return <Grid key="grid" camera={camera} grid={grid} />;
};
