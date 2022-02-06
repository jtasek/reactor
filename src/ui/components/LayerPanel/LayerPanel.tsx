import React, { FC } from 'react';
import { LayerPanelItem } from './LayerPaneltem';
import styles from './styles.css';

export interface Props {
  layersIds: string[];
}

export const LayerPanel: FC<Props> = ({ layersIds }) => (
  <ul className={styles.layerPanel}>
    {layersIds.map((layerId) => (
      <LayerPanelItem key={layerId} layerId={layerId} />
    ))}
  </ul>
);
