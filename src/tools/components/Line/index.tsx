import React, { FC } from 'react';
import styles from '../../styles.css';
import { useState } from 'src/app/hooks';
import { Pointer } from 'src/events/types';

/**
 * Draws a line from the start point to the end point
 **/

interface Props {
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  selected: boolean;
  type: string;
}

export function createLine({ topLeftPosition, bottomRightPosition }: Pointer): Props {
  return {
    name: 'Line x',
    x1: topLeftPosition.x,
    y1: topLeftPosition.y,
    x2: bottomRightPosition.x,
    y2: bottomRightPosition.y,
    selected: true,
    type: 'line'
  };
}

export const Line: FC<Props> = ({ x1, y1, x2, y2, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return <line key="line" className={className} x1={x1} y1={y1} x2={x2} y2={y2} />;
};

export const DesignLine: FC = () => {
  const { pointer } = useState().events;

  return <Line {...createLine(pointer)} />;
};
