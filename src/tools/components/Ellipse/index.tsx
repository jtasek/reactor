import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';
import type { Point, Size } from 'src/app/types';
import type { Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';
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
  code: string;
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
    code: 'ellipse',
    cx: centre.x,
    cy: centre.y,
    rx: size.width,
    ry: size.height,
    name: 'Ellipse x',
    selected: true,
    type: 'ellipse'
  };
};

export const Ellipse: FC<Props> = ({ name, cx, cy, rx, ry, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return (
    <ellipse key="ellipse" data-cy={name} className={className} cx={cx} cy={cy} rx={rx} ry={ry} />
  );
};

export const EllipseTool: FC = () => {
  const { pointer } = useAppState().events;

  return <Ellipse key="ellipse" {...createEllipse(pointer)} />;
};

export default {
  code: 'ellipse',
  name: 'Ellipse',
  description: 'Draws ellipse',
  factory: createEllipse,
  tool: EllipseTool,
  component: Ellipse,
  icon: {
    group: 'image',
    name: 'panorama_fish_eye',
    color: 'rgb(144, 254, 214)',
    size: 24
  },
  regex: /(?<toolCode>ellipse)\((?<cx>\d+),(?<cy>\d+),(?<radius>\d+)\)/,
  shortcut: 'ctrl+e',
  type: 'ellipse'
} as Tool;
