import React from 'react';
import { NavBarList } from './NavBarList';
import { NavBarListItem } from './NavBarListItem';
import { useActions, useCurrentDocument, useShape } from 'src/app/hooks';

const ShapesListItem = ({ shapeId }) => {
  const shape = useShape(shapeId);
  const { toggleShapeSelected } = useActions();

  return (
    <NavBarListItem
      key={shapeId}
      id={shapeId}
      name={shape.name}
      selected={shape.selected}
      onClick={toggleShapeSelected}
    />
  );
};

export const ShapesList = () => {
  const { shapesIds } = useCurrentDocument();

  if (shapesIds?.length === 0) {
    return null;
  }

  return (
    <NavBarList name="Shapes">
      {shapesIds.map((shapeId) => (
        <ShapesListItem key={shapeId} shapeId={shapeId} />
      ))}
    </NavBarList>
  );
};
