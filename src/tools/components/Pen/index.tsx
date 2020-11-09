import React, { FC } from 'react';
import { Point } from 'src/app/types';
import { stringifyPath } from 'src/app/utils';
import { Pointer } from 'src/events/types';
import { useState } from 'src/app/hooks';
import styles from '../../styles.css';

/** 
 * Draws a line based on path
 
 <polyline points="the points on the polyline. Required." />
  
**/

interface Props {
  name: string;
  points: Point[];
  selected: true;
  type: string;
}

export function createPen({ path }: Pointer): Props {
  return {
    name: 'Pen x',
    points: path,
    selected: true,
    type: 'pen'
  };
}

export const Pen: FC<Props> = ({ points, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return <polyline key="line" className={className} points={stringifyPath(points)} />;
};

export const DesignPen: FC = () => {
  const { pointer } = useState().events;

  return <Pen {...createPen(pointer)} selected={true} />;
};