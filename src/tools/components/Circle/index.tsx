import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';
import type { Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';
import type { Point } from '../../../app/types';
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
  code: string;
  name: string;
  cx: number;
  cy: number;
  r: number;
  selected: boolean;
  type: string;
}

export const createCircle = ({ centre, radius }: Pointer): Props => {
  return {
    code: 'circle',
    cx: centre.x,
    cy: centre.y,
    r: radius,
    name: 'Circle x',
    selected: true,
    type: 'circle'
  };
};

export const Circle: FC<Props> = ({ code, cx, cy, r, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return (
    <circle
      key="circle"
      fill="none"
      stroke="grey"
      strokeWidth={2}
      data-cy={code}
      className={className}
      onClick={() => alert('CIRCLE')}
      cx={cx}
      cy={cy}
      r={r}
    />
  );
};

export const CircleTool: FC = () => {
  const { pointer } = useAppState().events;

  return <Circle key="circle" {...createCircle(pointer)} />;
};

export const CircleCommand: Tool = {
  id: 'circle',
  name: 'Circle',
  description: 'Draw a circle',
  factory: createCircle,
  tool: CircleTool,
  component: Circle,
  icon: {
    group: 'image',
    name: 'panorama_fish_eye',
    // color: 'rgb(144, 254, 214)',
    size: 24
  },
  regex: /(?<toolCode>circle)\((?<cx>\d+),(?<cy>\d+),(?<radius>\d+)\)/,
  shortcut: 'ctrl+c',
};
