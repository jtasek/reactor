import React from 'react';
import { NavBarList } from './NavBarList';
import { NavBarListItem } from './NavBarListItem';
import { useActions, useCurrentDocument, useLayer } from 'src/app/hooks';

const LayerListItem = ({ layerId }) => {
  const layer = useLayer(layerId);
  const { toggleLayerSelected } = useActions();

  return (
    <NavBarListItem
      key={layerId}
      id={layerId}
      name={layer.name}
      selected={layer.selected}
      onClick={toggleLayerSelected}
    />
  );
};

export const LayersList = () => {
  const { layersIds } = useCurrentDocument();

  if (layersIds?.length === 0) {
    return null;
  }

  return (
    <NavBarList name="Layers">
      {layersIds.map((layerId) => (
        <LayerListItem key={layerId} layerId={layerId} />
      ))}
    </NavBarList>
  );
};
