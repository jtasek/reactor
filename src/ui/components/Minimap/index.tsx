import React, { FC } from 'react';

import { useControls } from 'src/app/hooks';
import { Grid } from '../Grid/Grid';
import { Rulers } from '../Surface/Rulers';
import { Shapes } from '../Surface/Shapes';
import { MiniMap } from './MiniMap';

const STATIC_CAMERA = { position: { x: 0, y: 0 }, scale: 1 };

export const MiniMapContainer: FC = () => {
  const { grid, miniMap } = useControls();

  if (!miniMap.visible) {
    return null;
  }

  return (
    <MiniMap size={{ width: 200, height: 200 }}>
      {grid.visible && <Grid camera={STATIC_CAMERA} grid={grid} />}
      <Rulers key="minimap-rulers" camera={STATIC_CAMERA} />
      <Shapes />
    </MiniMap>
  );
};
