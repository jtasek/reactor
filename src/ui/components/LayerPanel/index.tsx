import React, { FC } from 'react';

import { useControls, useCurrentDocument } from 'src/app/hooks';

import { LayerPanel } from './LayerPanel';
import styles from './styles.css';

export const LayerPanelContainer: FC = () => {
  const { layersIds } = useCurrentDocument();
  const { layerPanel } = useControls();

  if (!layerPanel.visible) {
    return null;
  }

  return <LayerPanel layersIds={layersIds} />;
};
