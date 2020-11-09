import React, { FC } from 'react';
import { useState } from 'src/app/hooks';

import { LayerPanel } from './LayerPanel';
import styles from './styles.css';

export const LayerPanelContainer: FC = () => {
  const { currentDocument, ui } = useState();

  if (!ui.layerPanel.visible) {
    return null;
  }

  return <LayerPanel layers={Object.values(currentDocument.layers)} />;
};
