import React, { FC } from 'react';
import { useState } from 'src/app/hooks';
import { Point } from '../../../app/types';
import styles from '../../styles.css';

/**
 * Draws a circle based on input centre point and radius

<circle 
    cx="the x-axis center of the circle" 
    cy="the y-axis center of the circle" 
    r="The circle's radius. Required." 
/>
**/

interface Props {
  name: string;
  cx: number;
  cy: number;
  r: number;
  selected: boolean;
  type: string;
}

export const createCircleProps = ({ centre, radius }: { centre: Point; radius: number }): Props => {
  return {
    cx: centre.x,
    cy: centre.y,
    r: radius,
    name: 'Circle x',
    selected: true,
    type: 'circle'
  };
};

export const Circle: FC<Props> = ({ name, cx, cy, r, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return <circle key="circle" data-cy={name} className={className} cx={cx} cy={cy} r={r} />;
};

export const DesignCircle: FC = () => {
  const { pointer } = useState().events;

  return <Circle {...createCircleProps(pointer)} />;
};
