import React, { FC } from 'react';
import { useState } from 'src/app/hooks';
import { Point, Size } from 'src/app/types';
import { Pointer } from 'src/events/types';
import styles from '../../styles.css';

/**
 * Draws an ellipse based on input coords and size

<ellipse 
    cx="the x-axis center of the ellipse"
    cy="the y-axis center of the ellipse"
    rx="the length of the ellipse's radius along the x-axis. Required."
    ry="the length of the ellipse's radius along the y-axis. Required." 
/>
**/

interface Props {
  name: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  selected: boolean;
  type: string;
}

export const createEllipse = ({ centre, size }: Pointer): Props => {
  return {
    cx: centre.x,
    cy: centre.y,
    rx: size.width,
    ry: size.height,
    name: 'Circle x',
    selected: true,
    type: 'circle'
  };
};

export const Ellipse: FC<Props> = ({ name, cx, cy, rx, ry, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return (
    <ellipse key="circle" data-cy={name} className={className} cx={cx} cy={cy} rx={rx} ry={ry} />
  );
};

export const DynamicEllipse: FC = () => {
  const { pointer } = useState().events;

  return <Ellipse {...createEllipse(pointer)} />;
};
