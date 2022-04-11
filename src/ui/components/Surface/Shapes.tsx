import React, { FC } from 'react';
import { useCurrentDocument } from 'src/app/hooks';
import { Shape } from '../Shape/Shape';

export const Shapes: FC = () => {
  const { shapesIds } = useCurrentDocument();

  return (
    <g id="shapes">
      {shapesIds.map((shapeId) => (
        <Shape key={shapeId} shapeId={shapeId} />
      ))}
    </g>
  );
};
