import React, { FC } from 'react';
import {useCurrentDocument, useAppState } from 'src/app/hooks';

import { LayerPanel } from './LayerPanel';
import styles from './styles.css';

export const LayerPanelContainer: FC = () => {
  const { layersIds } = useCurrentDocument();
  const { visible } = useAppState((state) => state.ui.layerPanel);

  if (!visible) {
    return null;
  }

  return <LayerPanel layersIds={layersIds} />;
};
