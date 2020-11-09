import React, { FC } from 'react';
import { Layer } from '../../../app/types';

import { LayerPanelItem } from './LayerPaneltem';
import styles from './styles.css';

export interface Props {
  layers?: Layer[];
}

export const LayerPanel: FC<Props> = ({ layers }) => (
  <ul className={styles.layerPanel}>
    {layers &&
      layers.length > 0 &&
      layers.map((layer) => <LayerPanelItem key={layer.id} layer={layer} />)}
  </ul>
);
