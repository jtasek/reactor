import React, { FC } from 'react';

import { useControls, useLayersIds } from 'src/app/hooks';

import { LayerPanel } from './LayerPanel';

export const LayerPanelContainer: FC = () => {
    const layersIds = useLayersIds();
    const { layerPanel } = useControls();

    if (!layerPanel.visible) {
        return null;
    }

    return <LayerPanel layersIds={layersIds} />;
};
