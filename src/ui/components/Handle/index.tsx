import React, { FC } from 'react';
import styles from './styles.css';
import type { Position } from '../../../app/types';

export interface Props {
  position: Position;
  size: number;
}

export const Handle: FC<Props> = ({ position, size }) => (
  <circle className={styles.handle} cx={position.x} cy={position.y} r={size} />
);
