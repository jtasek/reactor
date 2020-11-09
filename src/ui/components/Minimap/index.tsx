import React, { FC } from 'react';
import { useState } from 'src/app/hooks';
import { Rulers } from '../Surface/Rulers';
import { Shapes } from '../Surface/Shapes';
import { MiniMap } from './MiniMap';

export const MiniMapContainer: FC = () => {
  const { ui } = useState();

  if (!ui.miniMap.visible) {
    return null;
  }

  return (
    <MiniMap size={{ width: 200, height: 200 }}>
      <Rulers />
      <Shapes />
    </MiniMap>
  );
};
