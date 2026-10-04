import React, { FC } from 'react';

import { useActions, useControls, useCurrentDocument } from 'src/app/hooks';

import { LayerPanel } from './LayerPanel';

export const LayerPanelContainer: FC = () => {
    const { layersIds } = useCurrentDocument();
    const { layerPanel } = useControls();
    const { hideControl } = useActions().ui;

    if (!layerPanel.visible) {
        return null;
    }

    return (
        <LayerPanel
            layersIds={layersIds}
            detached
            onPlacementChange={() => hideControl('layerPanel')}
        />
    );
};
