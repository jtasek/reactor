import React, { FC } from 'react';
import { GridContainer } from '../Grid';

import styles from './styles.css';

import { Size } from 'src/app/types';

export interface Props {
  size: Size;
}

export const MiniMap: FC<Props> = ({ size, children }) => (
  <svg className={styles.minimap} width={size.width} height={size.height} viewBox="0 0 1000 1000">
    <GridContainer key="map-grid" />
    {children}
  </svg>
);
