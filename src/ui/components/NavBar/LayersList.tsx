import React from 'react';
import { NavBarList } from './NavBarList';
import { NavBarListItem } from './NavBarListItem';
import { useActions, useCurrentDocument, useLayer } from 'src/app/hooks';

const LayerListItem = ({ layerId }: { layerId: string }) => {
    const layer = useLayer(layerId);
    const { toggleLayerSelected, toggleLayerLocked, toggleLayerVisible } = useActions();

    return (
        <NavBarListItem
            key={layerId}
            id={layerId}
            name={layer.name}
            selected={layer.selected}
            locked={layer.locked}
            visible={layer.visible}
            onClick={toggleLayerSelected}
            onToggleLocked={toggleLayerLocked}
            onToggleVisible={toggleLayerVisible}
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
            {layersIds.map((layerId: string) => (
                <LayerListItem key={layerId} layerId={layerId} />
            ))}
        </NavBarList>
    );
};
