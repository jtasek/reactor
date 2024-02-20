import React, { FC, useRef } from 'react';

import styles from '../../styles.css';
import type { Tool } from 'src/tools/types';
import { Command } from 'src/app/types';
import { Context } from 'src/app/hooks';
import { scaledCenter } from 'src/events/computed/pointer';
import { getBoundingBoxForCircle } from 'src/app/utils';
import { newShapeName } from 'src/app/factories';

/**
 * Draws a circle based on input center point and radius

<circle 
    cx="the x-axis center of the circle" 
    cy="the y-axis center of the circle" 
    r="The circle's radius. Required." 
/>
**/

interface Props {
  key: string;
  name: string;
  cx: number;
  cy: number;
  r: number;
  selected: boolean;
  type: string;
}

export const createCircleProps = ({ state }: Context, designMode = false) => {
  const { center, scaledCenter, radius, scaledRadius } = state.events.pointer;

  const name = designMode ? 'Circle x' : newShapeName();
  const key = name.toLowerCase();

  return {
    cx: designMode ? scaledCenter.x : center.x,
    cy: designMode ? scaledCenter.y : center.y,
    key,
    name,
    r: designMode ? scaledRadius : radius,
    selected: true,
    type: 'circle'
  };
};

export const Circle: FC<Props> = ({ name, cx, cy, r, selected }) => {
  const shape = useRef(null);
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;
  console.log('rendering Circle');

  return (
    <circle
      className={className}
      cx={cx}
      cy={cy}
      //data-cy={code}
      data-name={name}
      fill="none"
      key="circle"
      r={r}
      ref={shape}
      stroke="grey"
      strokeWidth={2}
      onClick={() => {
        // console.log('circle native bbox', shape.current.getBBox());
        // console.log(
        //   'circle cacl bbox',
        //   getBoundingBoxForCircle({ center: { x: cx, y: cy }, radius: r })
        // );
      }}
    />
  );
};

export const CircleCommand: Command = {
  id: 'circle',
  name: 'Circle',
  category: 'shapes',
  description: 'Draws a circle shape',
  icon: {
    group: 'image',
    name: 'panorama_fish_eye',
    color: 'rgb(144, 254, 214)',
    size: 24
  },
  regex: /(?<toolCode>circle)\((?<cx>\d+),(?<cy>\d+),(?<radius>\d+)\)/,
  shortcut: 'ctrl+c',
  canExecute: (context) => true,
  execute: (context: Context) =>
    React.createElement(Circle, createCircleProps(context), null),
  factory: (context: Context) => createCircleProps(context, true)
};

export const CircleTool: Tool = {
  id: 'circle',
  name: 'Circle',
  description: 'Draw a circle',
  command: CircleCommand,
  component: Circle
};
