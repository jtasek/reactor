import React, { FC } from 'react';
import { LayerPanelItem } from './LayerPaneltem';
import styles from './styles.css';

export interface Props {
  layersIds: string[];
}

export const LayerPanel: FC<Props> = ({ layersIds }) => {
  const showLayers = layersIds.length > 0;

  return (
    <ul className={styles.layerPanel}>
      {!showLayers && <li>No layers available</li>}
      {showLayers && layersIds.map((layerId) => <LayerPanelItem key={layerId} layerId={layerId} />)}
    </ul>
  );
};
